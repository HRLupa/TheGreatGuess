import json
from pathlib import Path
import re,os


def format_srt_time(seconds:int):
    """Convert seconds to SRT time format: HH:MM:SS,mmm"""
    milliseconds = round(seconds * 1000)

    hours = milliseconds // 3_600_000
    milliseconds %= 3_600_000

    minutes = milliseconds // 60_000
    milliseconds %= 60_000

    seconds = milliseconds // 1_000
    milliseconds %= 1_000

    return f"{hours:02}:{minutes:02}:{seconds:02},{milliseconds:03}"
def srt_time_to_seconds(timestamp:str):
    """Convert HH:MM:SS,mmm to seconds."""
    hours, minutes, seconds = timestamp.replace(",", ".").split(":")
    return (
        int(hours) * 3600
        + int(minutes) * 60
        + float(seconds)
    )
def srt_to_json(input_file:str|Path, output_file:str|Path, title:str):
    with open(input_file, "r", encoding="utf-8-sig") as f:
        content = f.read().strip()

    subtitles:list[dict[str,float|str]] = []

    # Split subtitles into blocks
    blocks = re.split(r"\n\s*\n", content)

    for block in blocks:
        lines = block.splitlines()

        if len(lines) < 3:
            continue
        # Read timestamps (second line, after the subtitle index)
        match = re.match(
            r"(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*"
            r"(\d{2}:\d{2}:\d{2}[,.]\d{3})",
            lines[1]
        )

        if not match:
            continue

        start = srt_time_to_seconds(match.group(1))
        end = srt_time_to_seconds(match.group(2))
        text = "\n".join(lines[2:])

        subtitles.append({
            "start": start,
            "duration": round(end - start, 3),
            "text": text
        })

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({title: subtitles}, f, ensure_ascii=False, indent=4)

    print(f"Converted {len(subtitles)} subtitles to {output_file}")


def json_to_srt(input_file:str|Path, output_file:str):
    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Your JSON contains a title as the key
    for title, subtitles in data.items():

        with open(output_file, "w", encoding="utf-8") as f:
            for i, subtitle in enumerate(subtitles, start=1):
                start = subtitle["start"]
                end = start + subtitle["duration"]
                text = subtitle["text"]

                f.write(f"{i}\n")
                f.write(
                    f"{format_srt_time(start)} --> "
                    f"{format_srt_time(end)}\n"
                )
                f.write(f"{text}\n\n")

        print(f"Converted '{title}' to {output_file}")
        break  # Remove this if you want to process multiple videos

srt_to_json(Path(os.path.dirname(__file__))/".."/"srt_subtitles"/"FR Tunic - Le jeu qui en cachait un autre.srt",Path(os.path.dirname(__file__))/"transcripts"/"French"/"j3VzaBcoDAI.json","The game that was hiding another")
# Example
#json_to_srt(Path(__file__)/".."/"transcripts"/"AutoFrench"/"j3VzaBcoDAI.json", "output.srt")