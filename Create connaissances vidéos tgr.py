import json
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound, VideoUnavailable

def load_all_videos_from_channel_json(json_file):
    with open(json_file, encoding="utf-8") as f:
        data = json.load(f)

    all_videos = []
    playlists = data.get("entries", [])
    for playlist in playlists:
        playlist_entries = playlist.get("entries", [])
        for video in playlist_entries:
            if video.get("_type") == "url" and video.get("ie_key") == "Youtube" and video.get("id"):
                all_videos.append({
                    "id": video["id"],
                    "title": video.get("title", "Titre inconnu")
                })
    return all_videos

def get_transcripts(video_list):
    transcripts = {}
    for video in video_list:
        vid = video["id"]
        print(f"Récupération du transcript de {video['title']} ({vid})...")
        try:
            transcript = YouTubeTranscriptApi.get_transcript(vid)
            transcripts[video["title"]] = transcript
        except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable):
            print(f"Pas de transcript disponible pour {video['title']}")
            transcripts[video["title"]] = None
    return transcripts

def save_transcripts(transcripts, filename="transcripts.json"):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(transcripts, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    videos = load_all_videos_from_channel_json("videos.json")
    print(f"{len(videos)} vidéos extraites.")

    transcripts = get_transcripts(videos)
    save_transcripts(transcripts)
    print("Transcriptions sauvegardées dans 'transcripts.json'.")
