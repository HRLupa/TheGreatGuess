import json
import random
from datetime import timedelta
from unidecode import unidecode

# Convertit secondes -> HH:MM:SS
def seconds_to_hms(seconds):
    return str(timedelta(seconds=int(seconds)))

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
def load_transcripts(filename="transcripts.json")->dict[str,list[dict]]:
    with open(filename, encoding="utf-8") as f:
        return json.load(f)
def get_durations(filename="videos.json"):
    with open("videos.json","r",encoding="utf-8") as f:
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
def closephrases(phrases:list[tuple[str]],ind,total=2):
    renvoi=[ind]
    cpt=0
    title=phrases[ind][0]
    bloqueavant=False
    bloqueapres=False
    while total>cpt:
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
                total+=1 #Trust, ça marche, faut juste que cpt avance de 1 de plus que total
        else:
            if bloqueapres:
                renvoi.insert(0,ind-((cpt//2)+1))
                cpt+=2
                total+=1
            else:
                if cpt%2==0:
                    renvoi.insert(0,ind-((cpt//2)+1))
                else:
                    renvoi.append(ind+(cpt//2)+1)
                cpt+=1
    return renvoi
# Le quiz
def quiz(transcripts, title_map, n=5):
    # Construire une liste de phrases (video_title, text, start)
    phrases = []
    for title, subs in transcripts.items():
        if subs:
            for entry in subs:
                phrases.append((title, entry["text"], entry["start"],entry["duration"]))
    score = 0
    durations=get_durations()
    for i in range(n):
        print(f"\nQuestion {i+1}/{n}")
        condition=True
        while condition:
            indphrase=random.randint(0,len(phrases)-1)
            if phrases[indphrase][3]>0.5:
                condition=False
        video_title, phrase, start_time, _ = phrases[indphrase]
        print(f"\nPhrase : « {phrase.replace("\n"," ")} »\n")

        # Titre
        guess_title = input("Nom de la vidéo ? ").strip()
        norm_guess = normalize(guess_title)
        expected_title = title_map.get(norm_guess)

        if expected_title!= video_title:
            print(f"Mauvais titre ! La vidéo était : {video_title} à {seconds_to_hms(start_time)}")
            indcontext=closephrases(phrases,indphrase)
            context=""
            for i in range(len(indcontext)):
                context+=" "+phrases[indcontext[i]][1]
            context=context.replace("\n"," ")
            #print(repr(context))
            print(f"\nContexte : {context}")
            continue
        else:
            print(f"Bien joué ! Le titre de la vidéo était bien \"{video_title}\" (Durée de {seconds_to_hms(durations[francais_anglais[video_title]])})")
        # Timestamp
        score+=1
        inv=True
        while inv:
            guess_time_str = input("Moment (HH::MM:SS) ? ").strip()
            guess_time = hms_to_seconds(guess_time_str)
            try:
                guess_time = hms_to_seconds(guess_time_str)
                inv=False
            except:
                print("Format de temps invalide.")
                continue
        if start_time<guess_time:
            guess_time+=1 #Don't know why but there's a missing second if I don't add this one
        print(f"Vous étiez à {seconds_to_hms(abs(start_time-guess_time))} du temps réel, c'était à {seconds_to_hms(start_time)}")
    print(f"\n🎉  Score final : {score}/{n}")

# Exemple d'alias personnalisés à ajouter
francais_anglais={'Mais pourquoi Nintendo porte plainte contre tout le monde ?': 'Mais pourquoi Nintendo porte plainte contre tout le monde ?', 'Quand 500 jeunes ont tenu une montagne contre les nazis': 'The time 500 youngsters held a mountain against the Nazis', 'Le jeu où on plante des sapins': 'Planting trees and feeling happy', "22 minutes de + pour comprendre l'univers": 'Another 22 minutes to understand the universe', 'La légende de Barbe Scintillante': 'The legend of Glitterbeard', "Créer (et détruire) la plus grosse licence d'Occident": 'How to build (and destroy) the largest franchise in the west', 'La plus belle des équipes': 'The most beautiful team there was', "22 minutes pour sauver l'univers (ok un peu plus)": '22 minutes to save the universe (alright, maybe a bit more)', "Qu'est-ce que le cinéma a appris au jeu vidéo ?": 'What video games learnt from cinema', "C'est quoi un bon film ?": 'What\'s a "good" movie ?', 'Tunic : Le jeu qui en cachait un autre': 'The game that was hiding another', 'Le mystère du 8': '88888888', 'Les clubs du futur': 'Gaming teams of the future', 'La géopolitique expliquée avec des pixels': 'Geopolitics explained through pixels', "La plus grande partie de capture de drapeau de l'histoire d'Internet": 'Greatest game of capture the flag ever played', 'Comment Among Us a explosé': 'How Among Us made it', 'La quête du dernier secret': 'The last big Secret', "L'incroyable histoire d'Otzdarva et de la run Dark Souls la plus difficile": 'The incredible story of Otzdarva and the hardest Dark Souls run'}
manual_aliases = {
    "Mais pourquoi Nintendo porte plainte contre tout le monde ?": [
        "nintendo","plaintes"
    ],
    "Quand 500 jeunes ont tenu une montagne contre les nazis": [
        "jeunes", "montagne", "nazis", "résistance", "glières"
    ],
    "Le jeu où on plante des sapins": [
        "sapins", "Terra Nil", "jeu sapins"
    ],
    "22 minutes de + pour comprendre l'univers": [
        "outer wilds 2","outer wilds dlc","ow2","hibous","ow 2","+"
    ],
    "La légende de Barbe Scintillante": [
        "barbe scintillante", "barbe", "sea of thieves","sot"
    ],
    "Créer (et détruire) la plus grosse licence d'Occident": [
        "créer licence","occident","cod","activision","infinity ward","infinityward"
    ],
    "La plus belle des équipes": [
        "équipe", "lol","rox tigers","roxtigers","rox","équipes","belle"
    ],
    "22 minutes pour sauver l'univers (ok un peu plus)": [
        "22 minutes", "outer wilds 1","outer wilds","ow1","ow 1","ow"
    ],
    "Qu'est-ce que le cinéma a appris au jeu vidéo ?": [
        "jeu vidéo","cinéma jeu vidéo","cinéma vs jeu vidéo"
    ],
    "C'est quoi un bon film ?": [
        "bon film", "film","cinéma","meilleurs"
    ],
    "Tunic : Le jeu qui en cachait un autre": [
        "tunic", "caché", "renard","ronard"
    ],
    "Le mystère du 8": [
        "le mystère du 8", "Stanley", "The Stanley Parable", "88888888", "8","trafiquer"
    ],
    "Les clubs du futur": [
        "clubs", "clubs futur", "futur", "clubs du futur","futurs","villes"
    ],
    "La géopolitique expliquée avec des pixels": [
        "place", "pixels", "rplace", "r/place","pixel war","reddit","guerre"
    ],
    "La plus grande partie de capture de drapeau de l'histoire d'Internet": [
        "capture de drapeau", "capture drapeau", "ctf", "internet","pol","4chan","histoire","shia","laboeuf","shia laboeuf","grenouille","commando"
    ],
    "Comment Among Us a explosé": [
        "among us", "explosé", "succès among us","among us succès"
    ],
    "La quête du dernier secret": [
        "dernier secret", "quête", "quête dernier", "secret","quête dernier secret","Shadow of the Colossus","sotc","porte"
    ],
    "L'incroyable histoire d'Otzdarva et de la run Dark Souls la plus difficile": [
        "otzdarva", "dark souls", "run","histoire otzdarva","ds","dark souls 2","ds2","abnh","all bosses no hit"
    ]
}
#print({list(manual_aliases.keys())[i]:list(get_durations().keys())[i] for i in range(len(manual_aliases))})

if __name__ == "__main__":
    transcripts = load_transcripts()
    title_map = build_title_aliases(transcripts, manual_aliases)
    quiz(transcripts, title_map, n=15)
