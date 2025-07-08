let transcripts,durations,francais_anglais,manual_aliases,title_map,phrases,current_question,ids

function normalize(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim()
}
function build_title_aliases(transcripts,manual_aliases) {
    let map={}
    for (const title in transcripts) {
        map[normalize(title)]=title //version anglaise
    }
    for (const real_title in manual_aliases) {
        manual_aliases[real_title].forEach(alias=>{
            map[normalize(alias)]=real_title
        })
        map[normalize(real_title)]=real_title //version francaise
    }
    return map
}
async function load_data() {
    transcripts=await ((await (fetch("myjson/transcripts.json"))).json())
    durations={}
    ids={}
    const videosJson=await (await fetch("myjson/videos.json")).json()
    videosJson.entries[0].entries.forEach(v=>{
        durations[v.title]=v.duration
        ids[v.title]=v.id
    })

    const statiques=await (await fetch("myjson/statiques.json")).json()
    francais_anglais=statiques.francais_anglais
    manual_aliases=statiques.manual_aliases

    title_map=build_title_aliases(transcripts,manual_aliases)
    phrases=get_phrases(transcripts)
} //kind of understood

function seconds_to_hms(seconds) {
    const pad=x=>x.toString().padStart(2,"0")
    return `${pad(Math.floor(seconds / 3600))}::${pad(Math.floor((seconds / 60)%60))}:${pad(Math.round(seconds%60))}`
}

function hms_to_seconds(hms) {
    let [h,ms]=hms.includes("::") ? hms.split("::") : ["0",hms]
    let [m,s]=ms.includes(":") ? ms.split(":") : [ms,"0"]
    return parseInt(h) * 3600+parseInt(m) * 60+parseInt(s)
}
function get_html_yt(id,start) {
    console.log(id,start)
    return "<iframe id=\"ytPlayer\" width=\"355\" height=\"188\" src=\"https://www.youtube.com/embed/"+id+"?start="+Math.floor(start)+"\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\" allowfullscreen> </iframe>"
}



function get_phrases(transcripts) {
    let out=[]
    for (const [title,subs] of Object.entries(transcripts)) {
        if (subs !== null){
            for (const sub of subs) {
                out.push([title,sub.text,sub.start,sub.duration])
            }
        }
    }
    return out
}


function close_phrases(ind,lengthMin) {
    let renvoi=[ind]
    let total=phrases[ind][1].length
    let cpt=0
    const title=phrases[ind][0]
    while (total<lengthMin) {
        let before=ind-((cpt>>1)+1)
        let after=ind+((cpt>>1)+1) // >>1 opération binaire de décalage, équivalent à division euclidienne par 2
        let added=false
        if (cpt%2===0 && before>=0 && phrases[before][0]===title) {
            renvoi.unshift(before)
            total+=phrases[before][1].length
            added=true
        } else if (after<phrases.length && phrases[after][0]===title) {
            renvoi.push(after)
            total+=phrases[after][1].length
            added=true
        }
        if (!added)
        {    
            console.log("C'est quoi ta vidéo frérot")
            break
        }
        cpt++
    }
    return renvoi
}

function get_question() {
    let ind
    do {
        ind=Math.floor(Math.random() * phrases.length)
    } while (phrases[ind][3] <= 0.5)
    return close_phrases(ind,50)
}


function score_guess_quadratic(guessTime,startTime,videoDuration) {
    let error=Math.abs(guessTime-startTime)
    let maxError=videoDuration * 0.35
    if (error>=maxError) return 0
    let errorRatio=error / maxError
    let score=200 * Math.pow(1.02-errorRatio,1.4)
    return Math.round(Math.min(score,200))
}

//html functions


let score=0
let validated=false
let totalpoints=0
textes={"video_title":submit_title,"time_input":submit_time}
for (const [id,func] of Object.entries(textes))
{
    document.getElementById(id).addEventListener("keydown",function(event) {
        if (event.key==="Enter"){
            func()
        }
    })
} 
/*textes.forEach((id,func) => {
    document.getElementById(id).addEventListener("keydown",function(event) {
        if (event.key==="Enter"){
            func()
        }
    })
})*/


async function new_question() {
    const indices=get_question()
    current_question=indices
    const phrase=indices.map(i=>phrases[i][1].trim()).join(" ")
    document.getElementById("phrase").innerText=`« ${phrase.replace("\n"," ")} »`
    document.getElementById("video_title").value=""
    document.getElementById("time_input").value=""
    document.getElementById("suivant").classList.add("hidden")
    document.getElementById("button title").classList.remove("hidden")
    document.getElementById("video_title").classList.remove("hidden")
    document.getElementById("video_player").classList.add("hidden")
    validated=false
    document.getElementById("result").innerHTML=""
    document.getElementById("contexte").innerHTML=""
}

function showContexte(time,title)
{
    contexte=""
    indcontext=close_phrases(current_question[current_question.length>>1],200)
    const phrase=indcontext.map(i=>phrases[i][1].trim()).join(" ")
    document.getElementById("video_player").innerHTML=get_html_yt(ids[title],phrases[indcontext[0]][2])
    document.getElementById("contexte").innerHTML="Contexte : "+phrase+"\n<br>\n<br>"
}
function printpopup(text) {
    popup=document.getElementById("points_popup")
    popup.innerHTML=text
    popup.classList.remove("opacity-0")
    popup.classList.add("opacity-100")

    // After 2 seconds, fade out
    setTimeout(() => {
        popup.classList.remove("opacity-100")
        popup.classList.add("opacity-0")
    }, 500)
}
function showPoints(amount) {
    //Not working currently, needs to be fixed
    //console.log("showPoints called with:", text)
    totalpoints+=amount
    document.getElementById("points_display").innerHTML="Points : "+totalpoints.toString()
    const popup = document.getElementById("points_popup")
    printpopup("+ "+amount.toString())
    /*popup.innerHTML = "+ "+amount.toString()

    popup.classList.remove("opacity-0")
    popup.classList.add("opacity-100")

    // After 2 seconds, fade out
    setTimeout(() => {
        popup.classList.remove("opacity-100")
        popup.classList.add("opacity-0")
    }, 500)*/
}

async function submit_title() {
    if (validated){
        return
    }
    validated=true
    const guessed_title=title_map[normalize(document.getElementById("video_title").value)]
    const expected_title=phrases[current_question[current_question.length>>1]][0]
    const start_time=phrases[current_question[current_question.length>>1]][2]
    console.log(phrases[current_question[current_question.length>>1]])
    let affichage=""
    if (francais_anglais[guessed_title]===expected_title)
    {
        showPoints(200)
        affichage="Bien joué ! Le titre de la vidéo était bien \""+guessed_title+"\" (Durée de "+seconds_to_hms(durations[expected_title])+")."
        document.getElementById("time_input").classList.remove("hidden")
        document.getElementById("button time").classList.remove("hidden")
    }
    else
    {
        showPoints(0)
        affichage="Mauvais titre ! La vidéo était « "+expected_title+" » à "+seconds_to_hms(start_time)
        showContexte(start_time,expected_title)
        document.getElementById("video_player").classList.remove("hidden")
        document.getElementById("suivant").classList.remove("hidden")
    }
    document.getElementById("video_title").classList.add("hidden")
    document.getElementById("button title").classList.add("hidden")
    document.getElementById("result").innerHTML=affichage
}
function submit_time() {
    const expected_title=phrases[current_question[current_question.length>>1]][0]
    const guess_time_str=document.getElementById("time_input").value
    if (isNaN(hms_to_seconds(guess_time_str)))
    {
        console.log("NaN")
        printpopup("Invalid time input")
        document.getElementById("time_input").value=""
        return 
    }
    const start_time=phrases[current_question[current_question.length>>1]][2]
    const durationvideo=durations[expected_title]
    const score=score_guess_quadratic(hms_to_seconds(guess_time_str),start_time,durationvideo)
    showPoints(score)
    document.getElementById("result").innerHTML="C'était à "+seconds_to_hms(start_time)+", vous étiez à "+seconds_to_hms(Math.abs(start_time-hms_to_seconds(guess_time_str)))+" du temps réel."
    document.getElementById("time_input").classList.add("hidden")
    document.getElementById("button time").classList.add("hidden")
    document.getElementById("suivant").classList.remove("hidden")
}

/*function submit_answer() {
    const guess_title=normalize(document.getElementById("video_title").value)
    const guess_time_str=document.getElementById("time_input").value
    const expected_title=phrases[current_question[current_question.length>>1]][0]
    const actual_title=title_map[guess_title]

    const start_time=phrases[current_question[current_question.length>>1]][2] //comment ça 2 ? C'est pas duration le 2 ?
    const durationvideo=durations[expected_title]

    let result=""
    if (francais_anglais[actual_title] !== expected_title) {
        result="❌ Mauvais titre ! La vidéo était « ${expected_title} » à ${seconds_to_hms(start_time)}"
    } else {
        score+=200
        const guessTime=hms_to_seconds(guess_time_str)
        const scoreGuess=score_guess_quadratic(guessTime+1,start_time,durationvideo) //à tester sans le +1
        score+=scoreGuess
        result="✅ Bon titre ! +200 points\n+${scoreGuess} points pour le temps\nTotal : ${score}"
    }
    document.getElementById("result").innerText=result
}*/
