let transcripts, durations, francais_anglais, anglais_francais, manual_aliases, title_map, phrases, current_question, ids
let totalpoints = 0
let validated = false

function normalize(text) {
    return text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : ""
}

function build_title_aliases(transcripts, manual_aliases) {
    let map = {}
    for (const title in transcripts) {
        if (transcripts[title] !== null) {
            map[normalize(title)] = title
        }
    }
    for (const real_title in manual_aliases) {
        if (manual_aliases[real_title]) {
            manual_aliases[real_title].forEach(alias => {
                map[normalize(alias)] = real_title
            })
        }
        map[normalize(real_title)] = real_title
    }
    return map
}

async function load_data() {
    try {
        const [transcriptsRes, videosRes, statiquesRes] = await Promise.all([
            fetch("myjson/transcripts.json"),
            fetch("myjson/videos.json"),
            fetch("myjson/statiques.json")
        ])

        transcripts = await transcriptsRes.json()
        const videosJson = await videosRes.json()
        const statiques = await statiquesRes.json()

        durations = {}
        ids = {}
        const rawVideos = videosJson.entries[0].entries

        rawVideos.forEach(v => {
            durations[v.title] = v.duration
            ids[v.title] = v.id
        })

        francais_anglais = statiques.francais_anglais || {}
        manual_aliases = statiques.manual_aliases || {}

        // Table inverse pour afficher les titres FR dans la barre latérale
        anglais_francais = {}
        for (const [fr, en] of Object.entries(francais_anglais)) {
            anglais_francais[en] = fr
        }

        title_map = build_title_aliases(transcripts, manual_aliases)
        phrases = get_phrases(transcripts)

        // FILTRAGE : Garder uniquement les vidéos avec des sous-titres existants et non vides
        const availableVideos = rawVideos.filter(v => {
            const subs = transcripts[v.title]
            return subs !== null && subs !== undefined && Array.isArray(subs) && subs.length > 0
        })

        render_video_sidebar(availableVideos)
        new_question()
    } catch (err) {
        console.error("Erreur lors du chargement des données :", err)
        const phraseEl = document.getElementById("phrase")
        if (phraseEl) {
            phraseEl.innerText = "Erreur de chargement (vérifiez la console et le serveur local)"
        }
    }
}

function render_video_sidebar(videos) {
    const listContainer = document.getElementById("video_list")
    const countContainer = document.getElementById("video_count")

    if (countContainer) countContainer.innerText = videos.length
    if (listContainer) {
        listContainer.innerHTML = videos.map(v => {
            // Traduction FR si disponible, sinon titre d'origine
            const titleFR = anglais_francais[v.title] || v.title
            return `
                <div class="flex items-center gap-3 p-2.5 hover:bg-base-200 rounded-xl transition-colors cursor-pointer">
                    <img src="https://img.youtube.com/vi/${v.id}/default.jpg" class="w-16 h-11 object-cover rounded-md shadow" alt="${titleFR}" />
                    <div class="flex-1 min-w-0">
                        <p class="font-semibold text-base truncate text-base-content" title="${titleFR}">${titleFR}</p>
                        <p class="text-xs text-base-content/60 font-mono">${seconds_to_hms(v.duration)}</p>
                    </div>
                </div>
            `
        }).join('')
    }
}

function seconds_to_hms(seconds) {
    const pad = x => x.toString().padStart(2, "0")
    return `${pad(Math.floor(seconds / 3600))}::${pad(Math.floor((seconds / 60) % 60))}:${pad(Math.round(seconds % 60))}`
}

function hms_to_seconds(hms) {
    let [h, ms] = hms.includes("::") ? hms.split("::") : ["0", hms]
    let [m, s] = ms.includes(":") ? ms.split(":") : [ms, "0"]
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s)
}

function get_html_yt(id, start) {
    return `<iframe id="ytPlayer" class="w-full h-64 md:h-80 rounded-xl shadow-lg" src="https://www.youtube.com/embed/${id}?start=${Math.floor(start)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
}

function get_phrases(transcripts) {
    let out = []
    for (const [title, subs] of Object.entries(transcripts)) {
        if (subs !== null && subs !== undefined && Array.isArray(subs)) {
            for (const sub of subs) {
                out.push([title, sub.text, sub.start, sub.duration])
            }
        }
    }
    return out
}

function close_phrases(ind, lengthMin) {
    let renvoi = [ind]
    let total = phrases[ind][1].length
    let cpt = 0
    const title = phrases[ind][0]
    while (total < lengthMin) {
        let before = ind - ((cpt >> 1) + 1)
        let after = ind + ((cpt >> 1) + 1)
        let added = false
        if (cpt % 2 === 0 && before >= 0 && phrases[before][0] === title) {
            renvoi.unshift(before)
            total += phrases[before][1].length
            added = true
        } else if (after < phrases.length && phrases[after][0] === title) {
            renvoi.push(after)
            total += phrases[after][1].length
            added = true
        }
        if (!added) break
        cpt++
    }
    return renvoi
}

function get_question() {
    let ind
    do {
        ind = Math.floor(Math.random() * phrases.length)
    } while (phrases[ind][3] <= 0.5)
    return close_phrases(ind, 50)
}

function score_guess_quadratic(guessTime, startTime, videoDuration) {
    let error = Math.abs(guessTime - startTime)
    let maxError = videoDuration * 0.35
    if (error >= maxError) return 0
    let errorRatio = error / maxError
    let score = 200 * Math.pow(1.02 - errorRatio, 1.4)
    return Math.round(Math.min(score, 200))
}

function new_question() {
    if (!phrases || phrases.length === 0) return
    const indices = get_question()
    current_question = indices
    const phrase = indices.map(i => phrases[i][1].trim()).join(" ")
    
    document.getElementById("phrase").innerText = `« ${phrase.replace("\n", " ")} »`
    document.getElementById("video_title").value = ""
    document.getElementById("time_input").value = ""
    
    document.getElementById("suivant").classList.add("hidden")
    document.getElementById("button_title").classList.remove("hidden")
    document.getElementById("video_title").classList.remove("hidden")
    document.getElementById("time_input").classList.add("hidden")
    document.getElementById("button_time").classList.add("hidden")
    document.getElementById("video_player").classList.add("hidden")
    
    validated = false
    document.getElementById("result").innerHTML = ""
    document.getElementById("contexte").innerHTML = ""
}

function showContexte(time, title) {
    const indcontext = close_phrases(current_question[current_question.length >> 1], 200)
    const phrase = indcontext.map(i => phrases[i][1].trim()).join(" ")
    document.getElementById("video_player").innerHTML = get_html_yt(ids[title], phrases[indcontext[0]][2])
    document.getElementById("contexte").innerHTML = "Contexte : " + phrase
}

function printpopup(text) {
    const popup = document.getElementById("points_popup")
    if (!popup) return
    popup.innerHTML = text
    popup.classList.remove("opacity-0")
    popup.classList.add("opacity-100")
    setTimeout(() => {
        popup.classList.remove("opacity-100")
        popup.classList.add("opacity-0")
    }, 1500)
}

function showPoints(amount) {
    totalpoints += amount
    document.getElementById("points_display").innerHTML = "Points : " + totalpoints
    printpopup("+ " + amount + " points!")
}

async function submit_title() {
    if (validated) return
    validated = true

    const rawInput = document.getElementById("video_title").value
    const guessed_title = title_map[normalize(rawInput)]
    const expected_title = phrases[current_question[current_question.length >> 1]][0]
    const start_time = phrases[current_question[current_question.length >> 1]][2]

    let affichage = ""
    if (guessed_title && francais_anglais[guessed_title] === expected_title) {
        showPoints(200)
        affichage = "Bien joué ! Le titre de la vidéo était bien \"" + guessed_title + "\"."
        document.getElementById("time_input").classList.remove("hidden")
        document.getElementById("button_time").classList.remove("hidden")
    } else {
        showPoints(0)
        affichage = "Mauvais titre ! La vidéo était « " + expected_title + " » à " + seconds_to_hms(start_time)
        showContexte(start_time, expected_title)
        document.getElementById("video_player").classList.remove("hidden")
        document.getElementById("suivant").classList.remove("hidden")
    }

    document.getElementById("video_title").classList.add("hidden")
    document.getElementById("button_title").classList.add("hidden")
    document.getElementById("result").innerHTML = affichage
}

function submit_time() {
    const expected_title = phrases[current_question[current_question.length >> 1]][0]
    const guess_time_str = document.getElementById("time_input").value
    const secondsGuessed = hms_to_seconds(guess_time_str)

    if (isNaN(secondsGuessed)) {
        printpopup("Format invalide")
        document.getElementById("time_input").value = ""
        return
    }

    const start_time = phrases[current_question[current_question.length >> 1]][2]
    const durationvideo = durations[expected_title]
    const score = score_guess_quadratic(secondsGuessed, start_time, durationvideo)

    showPoints(score)
    document.getElementById("result").innerHTML = "C'était à " + seconds_to_hms(start_time) + ", vous étiez à " + seconds_to_hms(Math.abs(start_time - secondsGuessed)) + " du temps réel."

    document.getElementById("time_input").classList.add("hidden")
    document.getElementById("button_time").classList.add("hidden")
    document.getElementById("suivant").classList.remove("hidden")
}

document.addEventListener("DOMContentLoaded", () => {
    const inputs = [
        { id: "video_title", func: submit_title },
        { id: "time_input", func: submit_time }
    ]

    inputs.forEach(({ id, func }) => {
        const el = document.getElementById(id)
        if (el) {
            el.addEventListener("keydown", (event) => {
                if (event.key === "Enter") func()
            })
        }
    })

    load_data()
})