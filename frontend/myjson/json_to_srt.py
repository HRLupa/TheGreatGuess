import json
from pathlib import Path


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

# Example
json_to_srt(Path(__file__)/".."/"transcripts"/"AutoFrench"/"j3VzaBcoDAI.json", "output.srt")