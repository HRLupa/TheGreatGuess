import json
import random
from unidecode import unidecode
nbquestions=30

# Convertit secondes -> HH:MM:SS
def seconds_to_hms(seconds):
    return f"{afftime(int(seconds//3600))}::{afftime(int((seconds//60)%60))}:{afftime(int(seconds%60))}"
def afftime(time:int):
    string=str(time)
    if len(string)==1:
        string="0"+string
    return string
# Convertit HH:MM:SS -> secondes
def hms_to_seconds(hms_str:str):
    if hms_str.find("::")!=-1:
        h,ms=hms_str.split("::")
        if ms.find(":")!=-1:
            m,s=ms.split(":")
        else:
            m,s=ms,0
    else:
        h=0
        if hms_str.find(":")!=-1:
            m,s=hms_str.split(":")
        else:
            m,s=hms_str,0
    return int(h)*3600+int(m)*60+int(s)

# Normalise un texte : minuscule, strip, sans accents
def normalize(text):
    return unidecode(text.strip().lower())

# Charge les transcriptions
def load_json(filename="transcripts.json"):
    with open(filename, encoding="utf-8") as f:
        return json.load(f)
def get_durations(filename="videos.json"):
    with open(filename,"r",encoding="utf-8") as f:
        data=json.load(f)
    return {videos["title"]:videos["duration"] for videos in data["entries"][0]["entries"]}

# Génère une correspondance souple des titres
def build_title_aliases(transcripts:dict[str,list[dict]], manual_aliases:dict[str:list[str]]=None):
    title_map = {}
    for title in transcripts.keys():
        title_map[normalize(title)] = title

    if manual_aliases:
        for real_title, aliases in manual_aliases.items():
            for alias in aliases:
                title_map[normalize(alias)] = real_title
        title_map[normalize(real_title)]=real_title
    return title_map
def closephrases(phrases:list[tuple[str]],ind,lengthmin=100):
    renvoi=[ind]
    cpt=0
    title=phrases[ind][0]
    bloqueavant=False
    bloqueapres=False
    curlength=len(phrases[ind][1])
    while lengthmin>curlength:
        if ind-((cpt//2)+1)==0 or phrases[ind-((cpt//2)+1)][0]!=title:
            bloqueavant=True
        if ind+(cpt//2)+1==len(phrases)-1 or phrases[ind+(cpt//2)+1][0]!=title:
            bloqueapres=True
        if bloqueavant:
            if bloqueapres:
                raise "C'est quoi ta vidéo frérot"
            else:
                renvoi.append(ind+(cpt//2)+1)
                cpt+=2
                curlength+=len(phrases[ind+(cpt//2)+1][1])
        else:
            if bloqueapres:
                renvoi.insert(0,ind-((cpt//2)+1))
                cpt+=2
                curlength+=len(phrases[ind-((cpt//2)+1)][1])
            else:
                if cpt%2==0:
                    renvoi.insert(0,ind-((cpt//2)+1))
                    curlength+=len(phrases[ind-((cpt//2)+1)][1])
                else:
                    renvoi.append(ind+(cpt//2)+1)
                    curlength+=len(phrases[ind+(cpt//2)+1][1])
                cpt+=1
    return renvoi
def score_guess_quadratic(guess_time, start_time, video_duration):
    error = abs(guess_time - start_time)
    max_error = video_duration * 0.35
    #print(error,max_error)
    if error >= max_error:
        return 0
    error_ratio = error / max_error
    #print(error_ratio)
    score = 200 * (1.02 - error_ratio) ** 1.4
    if score>200:
        score=200
    #print("score : ",score)
    return int(round(score))
def getphrases(transcripts):
    phrases = []
    for title, subs in transcripts.items():
        if subs:
            for entry in subs:
                phrases.append((title, entry["text"], entry["start"],entry["duration"]))
    return phrases
def getquestion(phrases):
    condition=True
    while condition:
        indphrase=random.randint(0,len(phrases)-1)
        if phrases[indphrase][3]>0.5: 
            condition=False
    return closephrases(phrases,indphrase,15)
def waitingtime():
    import os
    print("\033[1;30;40mPress any key to continue...\033[0m", end='', flush=True)
    if os.name == 'nt':  # Windows
        import msvcrt
        key = msvcrt.getch().decode()
        print("\r\033[K",end="")
        return
    else:  # macOS/Linux
        import tty, termios
        fd = sys.stdin.fileno()
        old_settings = termios.tcgetattr(fd)
        try:
            tty.setraw(fd)
            key = sys.stdin.read(1)
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
        print("\r\033[K",end="")
        return key
def quiz(transcripts, title_map, n=5):
    phrases = getphrases(transcripts)
    score = 0
    rightguess=0
    durations=get_durations()
    for i in range(n):
        if i!=0:
            waitingtime()
            print()
        print(f"\nQuestion {i+1}/{n}")
        indquestions=getquestion(phrases)
        video_title, _, start_time, _ = phrases[indquestions[0]]
        phrase=""
        for i in range(len(indquestions)):
            phrase+=phrases[indquestions[i]][1].strip()+"  "
        print(f"Phrase : « {phrase.replace("\n"," ").strip()} »\n")
        guess_title = input("Thème de la vidéo ? (help) ")
        norm_guess = normalize(guess_title)
        if norm_guess=="help":
            vids=list(francais_anglais.keys())
            print()
            for i in range(len(vids)):
                print(vids[i])
            guess_title = input("\nThème de la vidéo ? ")
            norm_guess = normalize(guess_title)
        expected_title = title_map.get(norm_guess)
        #print(expected_title,video_title)
        if francais_anglais.get(expected_title)!= video_title:
            print(f"+ 0 points : {score}\n\nMauvais titre ! La vidéo était « {video_title} » à {seconds_to_hms(start_time)}")
            indcontext=closephrases(phrases,indquestions[len(indquestions)//2])
            context=""
            for i in range(len(indcontext)):
                context+=" "+phrases[indcontext[i]][1]
            context=context.replace("\n"," ")
            #print(repr(context))
            print(f"\nContexte : {context}")
            continue
        else:
            score+=200
            print(f"+ 200 points : {score}\n\nBien joué ! Le titre de la vidéo était bien \"{video_title}\" (Durée de {seconds_to_hms(durations[video_title])})")
            rightguess+=1
            #waitingtime()
        inv=True
        while inv:
            guess_time_str = input("Moment (HH::\033[1mMM\033[0m:SS) ? ").strip()
            try:
                guess_time = hms_to_seconds(guess_time_str)
                inv=False
            except:
                print("Format de temps invalide.")
                continue
        if start_time<guess_time:
            guess_time+=1 #Don't know why but there's a missing second if I don't add this one
        score_guess=score_guess_quadratic(guess_time,start_time,durations[video_title])
        score+=score_guess
        print(f"+{score_guess} points : {score}\n\nC'était à {seconds_to_hms(start_time)}, vous étiez à {seconds_to_hms(abs(start_time-guess_time))} du temps réel.")
    print(f"\n\n🎉  Score final : {score}/{400*n}\n🎮  Vidéos trouvées : {rightguess}/{n}")


statiques=load_json("statiques.json")
francais_anglais,manual_aliases=statiques["francais_anglais"],statiques["manual_aliases"]
if __name__ == "__main__":
    transcripts = load_json("transcripts.json")
    statiques=load_json("statiques.json")
    title_map = build_title_aliases(transcripts, manual_aliases)
    quiz(transcripts, title_map, n=nbquestions)
