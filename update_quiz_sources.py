import json
from typing import cast
import os
import sys
import time
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound, VideoUnavailable
mainpath=os.path.dirname(__file__)
sys.path.append(mainpath)

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

def get_transcripts(video_list:list[dict[str, str]]):
    transcripts:dict[str, list[dict[str, float|str]] | None] = {}
    with open(os.path.join(mainpath,"frontend","myjson","complete_transcripts.json"),encoding="utf-8") as f:
        complete=json.load(f)
    for video in video_list:
        if video["title"] not in complete:
            vid = video["id"]
            print(f"Récupération du transcript de {video['title']} ({vid})...")
            try:
                transcript= cast(list[dict[str, float|str]] | None,YouTubeTranscriptApi.get_transcript(vid))
                improve_transcript(transcript)
                transcripts[video["title"]]=transcript
                save_transcripts(transcripts)
            except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable):
                print(f"Pas de transcript disponible pour {video['title']}")
                transcripts[video["title"]] = None
    with open(os.path.join(mainpath,"frontend","myjson","complete_transcripts.json"),mode="w",encoding="utf-8") as f:
        json.dump(complete,f,ensure_ascii=False,indent=4)
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

    transcripts = get_transcripts(videos)
    save_transcripts(transcripts,filename=os.path.join(mainpath, "frontend", "myjson", "transcripts.json"))
    print("Transcriptions sauvegardées dans './frontend/myjson/transcripts.json'.") 