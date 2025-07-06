from quiz_module import score_guess_quadratic
def test_fonctions_scores(fonctiontest,ecartmin=0,ecartmax=0.1,lengthmin=3,lengthmax=150,nblengths=20,nbpourcentages=20):
    """fonctiontest prend en paramètre guesstime,start_time et video_duration (on considère que guess_time et start_time ne seront utilisés que pour calculer leurs différences)"""
    lengths=[lengthmin]
    pourcentages=[ecartmin]
    for i in range(1,nblengths):
        lengths.append(lengthmin+(lengthmax-lengthmin)/(nblengths-1)*(i))
    for i in range(1,nbpourcentages):
        pourcentages.append(100*(ecartmin+(ecartmax-ecartmin)/(nbpourcentages-1)*(i)))
    print(lengths,pourcentages)
    exp=" "*5
    for i in range(nblengths):
        exp+=str(round(lengths[i],1))+" "*(5-len(str(round(lengths[i],1))))
    exp+="\n"
    for i in range(nbpourcentages):
        exp+=str(round(pourcentages[i],1))+" "*(5-len(str(round(pourcentages[i],1))))
        for j in range(nblengths):
            result=fonctiontest((lengths[j]*60)*pourcentages[i]/100,0,lengths[j]*60)
            exp+=str(result)+" "*(5-len(str(result)))
        exp+="\n"
    print(exp)
    return

test_fonctions_scores(score_guess_quadratic)