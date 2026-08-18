import json
from typing import cast
import os
import sys
import yt_dlp
import requests
mainpath=os.path.dirname(__file__)
sys.path.append(mainpath)
transcriptsfile=os.path.join(mainpath,"frontend","myjson","transcriptsfr.json")
language="fr"


def get_channel(name:str,path:str):
    import subprocess
    subprocess.run(f'yt-dlp --flat-playlist --dump-single-json --write-subs --write-auto-subs --sub-langs "fr*" "https://www.youtube.com/@{name}"',stdout=open(path,"w",encoding="utf8"),shell=True)
    from pathlib import Path
    newpath: Path = Path(path)
    newpath.write_text(newpath.read_text(), encoding="utf8")
def load_all_videos_from_channel_json(json_file:str):
    with open(json_file, encoding="utf-8") as f:
        data = json.load(f)

    all_videos :list[dict[str, str]]= []
    playlist = data.get("entries", [])[0]
    playlist_entries = playlist.get("entries", [])
    for video in playlist_entries:
        if video.get("_type") == "url" and video.get("ie_key") == "Youtube" and video.get("id"):
            all_videos.append({
                "id": video["id"],
                "title": video.get("title", "Titre inconnu")
            })
    return all_videos

def improve_transcript(trans:list[dict[str, float|str]]|None):
    if trans is not None:
        bettertrans:list[dict[str, float|str]]=[]
        for i in range(len(trans)):
            ligne:str=cast(str, trans[i]["text"])
            parties=ligne.split("\n")
            modified_duration=round(cast(float, trans[i]["duration"])/len(parties),3)
            for j in range(len(parties)):
                bettertrans.append({"text":parties[j],"start":round(cast(float, trans[i]["start"])+modified_duration*j,3),"duration":modified_duration})
        trans=bettertrans
def improve_existant(path:str):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    for titre,transcripts in data.items():
        improve_transcript(transcripts)
        data[titre]=transcripts
    save_transcripts(data,path)

def get_single_transcript(video_id:str):
    ydl_opts:dict[str,bool|str|list[str]]= {
        "skip_download": True,
        "writesubtitles": True,
        "writeautomaticsub": True,
        "subtitleslangs": [language],
        "subtitlesformat": "json3",
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f"https://youtube.com/watch?v={video_id}", download=False)
        # Récupérer les sous-titres disponibles
        subtitles = info.get("subtitles", {})
        automatic_captions = info.get("automatic_captions", {})
        # On privilégie les sous-titres normaux
        lang = "fr"
        if lang in subtitles:
            subtitle_info = subtitles[lang]
        elif lang in automatic_captions:
            subtitle_info = automatic_captions[lang]
        else:
            raise ValueError("Aucun sous-titre français disponible.")
        # Chercher le format json3
        json3 = next((subtitle for subtitle in subtitle_info if subtitle.get("ext") == "json3"),None)
        if json3 is None:
            raise ValueError("Le format json3 n'est pas disponible.")
        response = requests.get(json3["url"])
        response.raise_for_status()
        data = response.json()
    transcript = []
    for event in data.get("events", []):
        if "segs" not in event:
            continue
        text = "".join(segment.get("utf8", "") for segment in event["segs"]).strip()
        if not text:
            continue
        start = event.get("tStartMs", 0) / 1000
        duration = event.get("dDurationMs", 0) / 1000
        transcript.append({"start": start,"duration": duration,"text": text})
    return transcript
def get_transcripts(video_list:list[dict[str, str]]):
    transcripts:dict[str, list[dict[str, float|str]] | None] = {}
    for video in video_list:
        vid = video["id"]
        print(f"Récupération du transcript de {video['title']} ({vid})...")
        transcript= cast(list[dict[str, float|str]] | None,get_single_transcript(vid))
        improve_transcript(transcript)
        transcripts[video["title"]]=transcript
        save_transcripts(transcripts)
    return transcripts

def save_transcripts(transcripts:dict[str, list[dict[str, float|str]] | None], filename:str="transcripts.json"):
    with open(filename,"r",encoding="utf-8") as f:
        current=json.load(f)
    for cle in transcripts.keys():
        if cle not in current.keys() or (current[cle]==None and transcripts[cle]!=None):
            current[cle]=transcripts[cle]
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(current, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    get_channel("TheGreatReview", os.path.join(mainpath, "frontend", "myjson", "videos.json"))
    videos = load_all_videos_from_channel_json(os.path.join(mainpath, "frontend", "myjson", "videos.json"))
    print(f"{len(videos)} vidéos extraites.")
    transcripts = get_transcripts(liste)
    save_transcripts(transcripts,filename=os.path.join(mainpath, "frontend", "myjson", "transcriptsfr.json"))
    print("Transcriptions sauvegardées dans './frontend/myjson/transcriptsfr.json'.") 