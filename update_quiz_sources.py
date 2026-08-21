import json
from typing import cast
import os
import sys
import yt_dlp
import requests
mainpath=os.path.dirname(__file__)
sys.path.append(mainpath)
mainjsonpath=os.path.join(mainpath,"frontend","myjson")
available_language:dict[str,dict[str,str|bool]]={"autofrench":{"path":os.path.join(mainjsonpath,"transcripts","AutoFrench"),"language":"fr","automatic":True},"manufrench":{"path":os.path.join(mainjsonpath,"transcripts","ManuFrench"),"language":"fr","automatic":False},"manuenglish":{"path":os.path.join(mainjsonpath,"transcripts","ManuEnglish"),"language":"en","automatic":False}}
chosen_language="autofrench"


def get_channel(name:str,path:str):
    import subprocess
    subprocess.run(f'yt-dlp --flat-playlist --dump-single-json --write-subs --write-auto-subs --sub-langs "fr*" "https://www.youtube.com/@{name}"',stdout=open(path,"w",encoding="utf8"),shell=True)
    from pathlib import Path
    newpath: Path = Path(path)
    newpath.write_text(newpath.read_text(), encoding="utf8")
def load_all_videos_from_channel_json(json_file:str):
    with open(json_file, encoding="utf-8") as f:
        data:dict[str, str| int| list[dict[str,str]]| list[dict[str,str | int]]| None| list[dict[str,str| int| list[dict[str, int]]| bool| dict[Any,Any]]]| dict[str,str| Unknown]]= json.load(f)

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
    """
    :param trans: Liste de dictionnaires représentant les segments de transcript. Chaque dictionnaire contient les clés "text", "start" et "duration".
    :return: None. La fonction modifie la liste trans en place.
    """
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
    save_transcript(data,path)

def get_transcript(video_id:str):
    ydl_opts:dict[str,bool|str|list[str]]= {
        "skip_download": True,
        "writesubtitles": True,
        "writeautomaticsub": available_language[chosen_language]["automatic"],
        "subtitleslangs": [cast(str, available_language[chosen_language]["language"])],
        "subtitlesformat": "json3",
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f"https://youtube.com/watch?v={video_id}", download=False)
        # Récupérer les sous-titres disponibles
        subtitles = info.get("subtitles", {})
        automatic_captions = info.get("automatic_captions", {})
        # On privilégie les sous-titres normaux
        lang = available_language[chosen_language]["language"]
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
    transcript:list[dict[str, float|str]]= []
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
def get_save_transcripts(video_list:list[dict[str, str]]):
    for video in video_list:
        vid = video["id"]
        print(f"Récupération du transcript de {video['title']} ({vid})...")
        transcript= cast(list[dict[str, float|str]] | None,get_transcript(vid))
        improve_transcript(transcript)
        #transcripts[video["title"]]=transcript
        save_transcript({video["title"]: transcript},vid+".json")
    return

def save_transcript(transcript:dict[str, list[dict[str, float|str]] | None], filename:str="transcripts.json"):
    """
    :param transcript: Dictionnaire contenant les transcripts à sauvegarder. La clé est le titre de la vidéo et la valeur est la liste des segments de transcript.
    :param filename: Nom du fichier dans lequel sauvegarder les transcripts. Par défaut, le fichier est nommé "transcripts.json".
    """
    with open(os.path.join(cast(str, available_language[chosen_language]["path"]),filename),"r",encoding="utf-8") as f:
        current=json.load(f)
    for cle in transcript.keys():
        if cle not in current.keys() or (current[cle]==None and transcript[cle]!=None):
            current[cle]=transcript[cle]
    with open(os.path.join(cast(str, available_language[chosen_language]["path"]),filename), "w", encoding="utf-8") as f:
        json.dump(current, f, ensure_ascii=False, indent=4)
    # Update index.json to include the new filename if it's not already there
    with open(os.path.join(cast(str, available_language[chosen_language]["path"]),"index.json"),"r") as f:
        index=json.load(f)
    if filename not in index:
        index.append(filename)
        with open(os.path.join(cast(str, available_language[chosen_language]["path"]),"index.json"),"w") as f:
            json.dump(index, f, ensure_ascii=False, indent=4)


if __name__ == "__main__":
    get_channel("TheGreatReview", os.path.join(mainjsonpath, "videos.json"))
    videos = load_all_videos_from_channel_json(os.path.join(mainjsonpath, "videos.json"))
    print(f"{len(videos)} vidéos extraites.")
    get_save_transcripts(videos)
    #save_transcript(transcripts,filename=os.path.join(ma, "transcriptsfr.json"))
    print("Transcriptions sauvegardées dans './frontend/myjson/transcriptsfr.json'.") 