#from quiz_module import score_guess_quadratic
textes=[["Durée de la vidéo","Pourcentage d'écart entre le temps deviné et le temps réel","Évaluation des score du quiz"],["Video duration","Difference percentage between the guessed time and the actual time","Guessing scores evalution"]]
import matplotlib.pyplot as plt
from typing import Callable
def score_guess_quadratic(guess_time:float, start_time:float, video_duration:float):
    error = abs(guess_time - start_time)
    max_error = video_duration * max(0.2,(0.8-0.5*(video_duration/7200)**0.2))
    #print(error,max_error)
    if error >= max_error:
        return 0
    error_ratio = error / max_error
    #print(error_ratio)
    score = 200 * (1.02 - error_ratio) ** 1.4
    if score>200:
        score=200
    #print("score : ",score)
    return score
def score_guess_hybrid(guess_time:float,start_time:float,video_duration:float):
    error=abs(guess_time-start_time)
    max_error=2.1*(video_duration**0.76)
    if error>=max_error:
        return 0
    error_ratio = error / max_error
    score=200*((1.02-error_ratio)**1.4)
    return min(200,score)
def test_fonctions_scores(fonctiontest:Callable[[float, float, float], int],ecartmin:float=0,ecartmax:float=1,lengthmin:int=1,lengthmax:int=150,video_lengths:list[int]|None=None,nblengths:int=100,nbpourcentages:int=100,correct_ratio:float=0.5):
    """fonctiontest prend en paramètre guesstime,start_time et video_duration (on considère que guess_time et start_time ne seront utilisés que pour calculer leurs différences)"""
    lengths:list[float]=[lengthmin]
    pourcentages:list[float]=[ecartmin]
    for i in range(1,nblengths):
        lengths.append(lengthmin+(lengthmax-lengthmin)/(nblengths-1)*(i))
    for i in range(1,nbpourcentages):
        pourcentages.append(100*(ecartmin+(ecartmax-ecartmin)/(nbpourcentages)*(i)))
    print(lengths,pourcentages)
    for j in range(len(textes)):
        if video_lengths:
            for k in range(len(video_lengths)):
                #plt.plot(pourcentages,[fonctiontest((video_lengths[j]*60*pourcentages[i]/100),video_lengths[j]*60*correct_ratio,video_lengths[j])])
                plt.plot(pourcentages,[fonctiontest((video_lengths[k]*60)*pourcentages[i]/100,video_lengths[k]*60*correct_ratio,video_lengths[k]*60) for i in range(len(pourcentages))])
            plt.legend([f"{textes[j][0]} : {video_lengths[k]} minutes" for k in range(len(video_lengths))])
        else:
            plt.plot(pourcentages,[fonctiontest((lengths[0]*60)*pourcentages[i]/100,(lengths[0]*60*correct_ratio),lengths[0]*60) for i in range(len(pourcentages))])
            plt.plot(pourcentages,[fonctiontest((lengths[nblengths//2]*60)*pourcentages[i]/100,lengths[nblengths//2]*60*correct_ratio,lengths[nblengths//2]*60) for i in range(len(pourcentages))])
            plt.plot(pourcentages,[fonctiontest((lengths[nblengths-1]*60)*pourcentages[i]/100,lengths[nblengths-1]*60*correct_ratio,lengths[nblengths-1]*60) for i in range(len(pourcentages))])
            plt.legend([f"{textes[j][0]} : {lengths[0]} minutes",f"{textes[j][0]} : {round(lengths[nblengths//2])} minutes",f"{textes[j][0]} : {round(lengths[nblengths-1])} minutes"])
        plt.xlabel(textes[j][1])
        plt.ylabel("Score")
        plt.title(textes[j][2])
        plt.grid(which='major',linewidth=0.5)
        plt.show()
    """exp=" "*6
    for i in range(nblengths):
        exp+=str(round(lengths[i],1))+" "*(6-len(str(round(lengths[i],1))))
    exp+="\n"
    for i in range(nbpourcentages):
        exp+=str(round(pourcentages[i],1))+" "*(6-len(str(round(pourcentages[i],1))))
        for j in range(nblengths):
            result=fonctiontest((lengths[j]*60)*pourcentages[i]/100,0,lengths[j]*60)
            exp+=str(result)+" "*(6-len(str(result)))
        exp+="\n"
    print(exp)"""
    return

test_fonctions_scores(score_guess_quadratic,nbpourcentages=3000,nblengths=3000,correct_ratio=0.5,lengthmax=60,video_lengths=[1,30,90])