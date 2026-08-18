from quiz_module import score_guess_quadratic
import matplotlib.pyplot as plt
from typing import Callable
def test_fonctions_scores(fonctiontest:Callable[[float, float, float], int],ecartmin:float=0,ecartmax:float=1,lengthmin:int=1,lengthmax:int=150,nblengths:int=100,nbpourcentages:int=100,correct_ratio:float=0.5):
    """fonctiontest prend en paramètre guesstime,start_time et video_duration (on considère que guess_time et start_time ne seront utilisés que pour calculer leurs différences)"""
    
    lengths:list[float]=[lengthmin]
    pourcentages:list[float]=[ecartmin]
    for i in range(1,nblengths):
        lengths.append(lengthmin+(lengthmax-lengthmin)/(nblengths-1)*(i))
    for i in range(1,nbpourcentages):
        pourcentages.append(100*(ecartmin+(ecartmax-ecartmin)/(nbpourcentages)*(i)))
    print(lengths,pourcentages)
    plt.plot(pourcentages,[fonctiontest((lengths[0]*60)*pourcentages[i]/100,(lengths[0]*60*correct_ratio),lengths[0]*60) for i in range(len(pourcentages))])
    plt.plot(pourcentages,[fonctiontest((lengths[nblengths//2]*60)*pourcentages[i]/100,lengths[nblengths//2]*60*correct_ratio,lengths[nblengths//2]*60) for i in range(len(pourcentages))])
    plt.plot(pourcentages,[fonctiontest((lengths[nblengths-1]*60)*pourcentages[i]/100,lengths[nblengths-1]*60*correct_ratio,lengths[nblengths-1]*60) for i in range(len(pourcentages))])
    plt.legend([f"Durée de la vidéo : {lengths[0]} minutes",f"Durée de la vidéo : {round(lengths[nblengths-1])} minutes",f"Durée de la vidéo : {round(lengths[nblengths//2])} minutes"])
    plt.xlabel("Pourcentage d'écart entre le temps deviné et le temps réel")
    plt.ylabel("Score")
    plt.title("Évaluation des scores de devinettes")
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

#test_fonctions_scores(score_guess_quadratic,nbpourcentages=3000,nblengths=3000,correct_ratio=0.8)