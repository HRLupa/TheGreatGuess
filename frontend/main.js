let transcripts, durations, francais_anglais, anglais_francais, manual_aliases, title_map, phrases, current_question, ids
let searchCandidates = []
let activeSuggestionIndex = -1
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

function build_search_candidates(availableVideos, manual_aliases, anglais_francais) {
    let candidates = []
    availableVideos.forEach(v => {
        const titleEN = v.title
        const titleFR = anglais_francais[titleEN] || titleEN

        // Rassemblement de tous les termes associables à cette vidéo
        let searchTerms = [titleFR, titleEN]
        if (manual_aliases[titleFR]) searchTerms.push(...manual_aliases[titleFR])
        if (manual_aliases[titleEN]) searchTerms.push(...manual_aliases[titleEN])

        candidates.push({
            display: titleFR,
            searchTerms: searchTerms.map(term => normalize(term))
        })
    })
    return candidates
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

        anglais_francais = {}
        for (const [fr, en] of Object.entries(francais_anglais)) {
            anglais_francais[en] = fr
        }

        title_map = build_title_aliases(transcripts, manual_aliases)
        phrases = get_phrases(transcripts)

        // Garde uniquement les vidéos avec sous-titres
        const availableVideos = rawVideos.filter(v => {
            const subs = transcripts[v.title]
            return subs !== null && subs !== undefined && Array.isArray(subs) && subs.length > 0
        })

        searchCandidates = build_search_candidates(availableVideos, manual_aliases, anglais_francais)

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

/* --- SUGGESTIONS & AUTOCOMPLÉTION --- */

function update_suggestions(query) {
    const suggestionsEl = document.getElementById("suggestions")
    if (!suggestionsEl) return

    const normQuery = normalize(query)
    if (normQuery.length === 0) {
        hide_suggestions()
        return
    }

    // Filtrage des vidéos correspondant au terme saisi ou à ses alias
    let matches = []
    searchCandidates.forEach(candidate => {
        const isMatch = candidate.searchTerms.some(term => term.includes(normQuery))
        if (isMatch) {
            matches.push(candidate.display)
        }
    })

    // Suppression des doublons et limitation à 6 résultats
    matches = [...new Set(matches)].slice(0, 6)

    if (matches.length === 0) {
        hide_suggestions()
        return
    }

    activeSuggestionIndex = -1
    suggestionsEl.innerHTML = matches.map((title, index) => `
        <div class="suggestion-item p-3.5 hover:bg-primary/20 cursor-pointer font-medium text-base transition-colors border-b border-base-200 last:border-none flex items-center justify-between" 
             data-index="${index}" 
             onclick="select_suggestion('${title.replace(/'/g, "\\'")}')">
            <span>${title}</span>
            <span class="text-xs text-base-content/40 italic">Suggestion</span>
        </div>
    `).join('')

    suggestionsEl.classList.remove("hidden")
}

function select_suggestion(title) {
    const input = document.getElementById("video_title")
    if (input) {
        input.value = title
    }
    hide_suggestions()
}

function hide_suggestions() {
    const suggestionsEl = document.getElementById("suggestions")
    if (suggestionsEl) suggestionsEl.classList.add("hidden")
    activeSuggestionIndex = -1
}

function update_active_suggestion(items) {
    items.forEach((item, idx) => {
        if (idx === activeSuggestionIndex) {
            item.classList.add("bg-primary", "text-primary-content")
            item.scrollIntoView({ block: "nearest" })
        } else {
            item.classList.remove("bg-primary", "text-primary-content")
        }
    })
}

function handle_title_keydown(e) {
    const suggestionsEl = document.getElementById("suggestions")
    const isVisible = suggestionsEl && !suggestionsEl.classList.contains("hidden")
    const items = suggestionsEl ? suggestionsEl.querySelectorAll(".suggestion-item") : []

    if (e.key === "ArrowDown" && isVisible && items.length > 0) {
        e.preventDefault()
        activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length
        update_active_suggestion(items)
    } else if (e.key === "ArrowUp" && isVisible && items.length > 0) {
        e.preventDefault()
        activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length
        update_active_suggestion(items)
    } else if (e.key === "Enter") {
        if (isVisible && activeSuggestionIndex >= 0 && items[activeSuggestionIndex]) {
            e.preventDefault()
            items[activeSuggestionIndex].click()
        } else {
            hide_suggestions()
            submit_title()
        }
    } else if (e.key === "Escape") {
        hide_suggestions()
    }
}

/* --- LOGIQUE DU JEU & AFFICHAGE --- */

function render_video_sidebar(videos) {
    const listContainer = document.getElementById("video_list")
    const countContainer = document.getElementById("video_count")

    if (countContainer) countContainer.innerText = videos.length
    if (listContainer) {
        listContainer.innerHTML = videos.map(v => {
            const titleFR = anglais_francais[v.title] || v.title
            return `
                <div class="flex items-center gap-3 p-2.5 hover:bg-base-200 rounded-xl transition-colors cursor-pointer" onclick="select_suggestion('${titleFR.replace(/'/g, "\\'")}')">
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
    
    hide_suggestions()
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

    hide_suggestions()
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
    const titleInput = document.getElementById("video_title")
    const timeInput = document.getElementById("time_input")

    if (titleInput) {
        titleInput.addEventListener("input", (e) => update_suggestions(e.target.value))
        titleInput.addEventListener("keydown", handle_title_keydown)
    }

    if (timeInput) {
        timeInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") submit_time()
        })
    }

    // Fermeture du menu déroulant au clic extérieur
    document.addEventListener("click", (e) => {
        if (!e.target.closest("#video_title") && !e.target.closest("#suggestions")) {
            hide_suggestions()
        }
    })

    load_data()
})