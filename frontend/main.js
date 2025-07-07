let transcripts,durations,francais_anglais,manual_aliases,title_map,phrases

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
    const videosJson=await (await fetch("myjson/videos.json")).json()
    videosJson.entries[0].entries.forEach(v=>{
        durations[v.title]=v.duration
    })

    const statiques=await (await fetch("myjson/statiques.json")).json()
    francais_anglais=statiques.francais_anglais
    manual_aliases=statiques.manual_aliases

    title_map=build_title_aliases(transcripts,manual_aliases)
    phrases=get_phrases(transcripts)
} //kind of understood

function seconds_to_hms(seconds) {
    const pad=x=>x.toString().padStart(2,"0")
    return `${pad(Math.floor(seconds / 3600))}::${pad(Math.floor((seconds / 60)%60))}:${pad(seconds%60)}`
}

function hms_to_seconds(hms) {
    let [h,ms]=hms.includes("::") ? hms.split("::") : ["0",hms]
    let [m,s]=ms.includes(":") ? ms.split(":") : [ms,"0"]
    return parseInt(h) * 3600+parseInt(m) * 60+parseInt(s)
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


function close_phrases(phrases,ind,lengthMin=100) {
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

function get_question(phrases) {
    let ind
    do {
        ind=Math.floor(Math.random() * phrases.length)
    } while (phrases[ind][3] <= 0.5)
    return close_phrases(phrases,ind,15)
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
let current_question
textes={"video_title":submit_title,"time_input":submit_time}
textes.forEach(id => {
    document.getElementById(id).addEventListener("keydown",function(event) {
        if (event.key==="Enter"){
            submit_answer()
        }
    })
})


async function new_question() {
    const indices=get_question(phrases)
    current_question=indices
    const phrase=indices.map(i=>phrases[i][1].trim()).join(" ")
    document.getElementById("phrase").innerText=`« ${phrase} »`
}

function submit_title() {
    const guessed_title=title_map[normalize(document.getElementById("video_title").value)]
    const expected_title=phrases[current_question[current_question.length>>1]][0]
    console.log(phrases[current_question[current_question.length>>1]])
    let affichage=""
    if (francais_anglais[guessed_title]===expected_title)
    {
        affichage=""
    }
}
function submit_time() {
    const guess_time_str=document.getElementById("time_input").value
    const start_time=phrases[current_question[current_question.length>>1]][2]
    const durationvideo=durations[expected_title]
    const score=score_guess_quadratic(parseInt(guess_time_str))
    let affichage=""
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
