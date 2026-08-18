// --- CONFIGURATION DES SOUS-TITRES ET LANGUES ---
const LANG_CONFIG = {
    fr: {
        label: "Français",
        folders: ["AutoFrench"]
    },
    en: {
        label: "English",
        folders: ["ManuEnglish"]
    }
}


let transcriptsByLang = {}
let transcripts = {}
let rawVideos = []
let current_lang = "fr"
let max_rounds=15
let durations, francais_anglais, anglais_francais, manual_aliases, title_map, phrases, current_question, ids
let searchCandidates = []
let activeSuggestionIndex = -1
let totalpoints = 0
let validated = false

/* --- GESTION DU THÈME (CLAIR / SOMBRE) --- */

function init_theme() {
    const savedTheme = localStorage.getItem("great_guess_theme") || "dark"
    apply_theme(savedTheme)
}

function apply_theme(theme) {
    document.documentElement.setAttribute("data-theme", theme)
    localStorage.setItem("great_guess_theme", theme)
    
    const sunIcon = document.getElementById("theme_icon_sun")
    const moonIcon = document.getElementById("theme_icon_moon")

    if (theme === "dark") {
        if (sunIcon) sunIcon.classList.remove("hidden")
        if (moonIcon) moonIcon.classList.add("hidden")
    } else {
        if (sunIcon) sunIcon.classList.add("hidden")
        if (moonIcon) moonIcon.classList.remove("hidden")
    }
}

function toggle_theme() {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "dark"
    const newTheme = currentTheme === "dark" ? "light" : "dark"
    apply_theme(newTheme)
}

/* --- GESTION DE LA LANGUE --- */

function change_language(newLang) {
    current_lang = newLang

    // 1. Récupération des sous-titres fusionnés pour la langue choisie
    transcripts = transcriptsByLang[current_lang] || {}

    // 2. Génération des alias et des répliques
    title_map = build_title_aliases(transcripts, manual_aliases)
    phrases = get_phrases(transcripts)

    // 3. Filtrer uniquement les vidéos présentes dans ce set de sous-titres
    const availableVideos = rawVideos.filter(v => {
        const subs = transcripts[v.title]
        return subs !== null && subs !== undefined && Array.isArray(subs) && subs.length > 0
    })

    // 4. Mise à jour de la recherche et de la sidebar
    searchCandidates = build_search_candidates(availableVideos, manual_aliases, anglais_francais)
    render_video_sidebar(availableVideos)

    // 5. Réinitialisation de la partie
    reset_game()
}

/* --- CHARGEMENT DES DONNÉES --- */

async function load_language_transcripts(langKey) {
    const config = LANG_CONFIG[langKey]
    if (!config || !config.folders) return {}

    let mergedTranscripts = {}

    for (const folder of config.folders) {
        try {
            const indexRes = await fetch(`myjson/transcripts/${folder}/index.json`)
            if (!indexRes.ok) continue

            const fileList = await indexRes.json()

            const fetchPromises = fileList.map(filename =>
                fetch(`myjson/transcripts/${folder}/${filename}`)
                    .then(res => res.ok ? res.json() : null)
                    .catch(() => null)
            )

            const results = await Promise.all(fetchPromises)

            results.forEach(data => {
                if (data && typeof data === "object" && !Array.isArray(data)) {
                    for (const [titleKey, subs] of Object.entries(data)) {
                        if (!Array.isArray(subs)) continue

                        // Convertit la clé vers le titre canonique (EN) si la clé était en FR
                        const canonicalTitle = francais_anglais[titleKey] || titleKey

                        // Sécurise la structure de chaque sous-titre
                        const cleanedSubs = subs.map(sub => ({
                            text: sub.text || sub.content || "",
                            start: parseFloat(sub.start ?? sub.start_time ?? 0),
                            duration: parseFloat(sub.duration ?? sub.dur ?? 2.0)
                        })).filter(sub => sub.text.trim().length > 0)

                        mergedTranscripts[canonicalTitle] = cleanedSubs
                    }
                }
            })
        } catch (err) {
            console.warn(`Impossible de charger le dossier : ${folder}`, err)
        }
    }

    return mergedTranscripts
}

async function load_data() {
    try {
        // 1. Chargement des données globales
        const [videosRes, statiquesRes] = await Promise.all([
            fetch("myjson/videos.json"),
            fetch("myjson/statiques.json")
        ])

        const videosJson = await videosRes.json()
        const statiques = await statiquesRes.json()

        durations = {}
        ids = {}
        rawVideos = videosJson.entries[0].entries

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

        // 2. Chargement dynamique de tous les dossiers de sous-titres configurés
        const langKeys = Object.keys(LANG_CONFIG)
        for (const lang of langKeys) {
            transcriptsByLang[lang] = await load_language_transcripts(lang)
        }

        // 3. Initialisation de la langue active
        change_language(current_lang)

    } catch (err) {
        console.error("Erreur de chargement des données :", err)
        const phraseEl = document.getElementById("phrase")
        if (phraseEl) phraseEl.innerText = "Erreur de chargement des fichiers JSON"
    }
}

function normalize(text) {
    return text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : ""
}

/* --- GESTION DES HIGH SCORES (LOCAL STORAGE) --- */

function get_highscore_key(rounds) {
    return `great_guess_highscore_${rounds}`
}

function get_highscore(rounds) {
    return parseInt(localStorage.getItem(get_highscore_key(rounds)) || "0", 10)
}

function save_highscore(rounds, score) {
    const current = get_highscore(rounds)
    if (score > current) {
        localStorage.setItem(get_highscore_key(rounds), score)
        return true
    }
    return false
}

function update_highscore_display() {
    const highscoreEl = document.getElementById("highscore_display")
    if (highscoreEl) {
        highscoreEl.innerText = get_highscore(max_rounds)
    }
}

/* --- FORMATTAGE & PARSEUR HMS --- */

function seconds_to_hms(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00"
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.round(seconds % 60)
    const pad = x => x.toString().padStart(2, "0")
    
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

function hms_to_seconds(input) {
    if (!input) return NaN
    let str = input.trim().toLowerCase().replace(",", ".")

    if (str.includes("h") || str.includes("m") || str.includes("s")) {
        const hMatch = str.match(/(\d+)\s*h/)
        const mMatch = str.match(/(\d+)\s*m/)
        const sMatch = str.match(/(\d+)\s*s/)

        const h = hMatch ? parseInt(hMatch[1], 10) : 0
        let m = mMatch ? parseInt(mMatch[1], 10) : 0
        const s = sMatch ? parseInt(sMatch[1], 10) : 0

        // Si aucun 'm' n'est présent mais qu'il y a des chiffres après le 'h' (ex: "1h15")
        if (!mMatch && hMatch) {
            const afterH = str.split("h")[1]
            const trailingDigits = afterH ? afterH.match(/^\s*(\d+)/) : null
            if (trailingDigits && !afterH.includes("s")) {
                m = parseInt(trailingDigits[1], 10)
            }
        }

        return h * 3600 + m * 60 + s
    }

    if (str.includes(":")) {
        const parts = str.split(":").map(p => parseInt(p, 10))
        if (parts.some(isNaN)) return NaN;
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
        if (parts.length === 2) return parts[0] * 60 + parts[1]
    }

    const num = parseFloat(str)
    return isNaN(num) ? NaN : Math.round(num * 60)
}

/* --- GESTION DES MANCHES ET DU SCORE --- */

function update_round_display() {
    const roundEl = document.getElementById("round_display")
    if (!roundEl) return
    if (max_rounds === 0) {
        roundEl.innerText = `${current_round} / ∞`
    } else {
        roundEl.innerText = `${current_round} / ${max_rounds}`
    }
}

function change_max_rounds(val) {
    max_rounds = parseInt(val, 10)
    update_highscore_display()
    reset_game()
}

function reset_game() {
    totalpoints = 0
    current_round = 1
    is_game_over = false
    is_game_started = false

    const roundSelect = document.getElementById("round_select")
    if (roundSelect) roundSelect.disabled = false

    const display = document.getElementById("points_display")
    if (display) display.innerText = "Points : 0"

    update_round_display()
    update_highscore_display()

    document.getElementById("quiz_content").classList.remove("hidden")
    document.getElementById("game_over_screen").classList.add("hidden")

    new_question()
}

function next_round() {
    if (max_rounds > 0 && current_round >= max_rounds) {
        show_game_over()
    } else {
        current_round++
        update_round_display()
        new_question()
    }
}

function show_game_over() {
    is_game_over = true
    document.getElementById("quiz_content").classList.add("hidden")

    const isNewRecord = save_highscore(max_rounds, totalpoints)
    
    const gameOverScreen = document.getElementById("game_over_screen")
    const finalScoreEl = document.getElementById("final_score")
    const maxPossibleEl = document.getElementById("max_possible_score")
    const recordBadge = document.getElementById("new_record_badge")
    const bestScoreText = document.getElementById("end_best_score")
    const progressBar = document.getElementById("score_progress_bar")

    const maxPossible = max_rounds * 400
    if (finalScoreEl) finalScoreEl.innerText = totalpoints
    if (maxPossibleEl) maxPossibleEl.innerText = maxPossible
    if (bestScoreText) bestScoreText.innerText = get_highscore(max_rounds)

    // Animation de la barre de progression
    if (progressBar) {
        const percentage = maxPossible > 0 ? Math.min(100, Math.round((totalpoints / maxPossible) * 100)) : 100
        // Léger timeout pour laisser l'écran s'afficher avant de déclencher la transition CSS
        setTimeout(() => {
            progressBar.style.width = `${percentage}%`
        }, 100)
    }

    if (recordBadge) {
        if (isNewRecord) {
            recordBadge.classList.remove("hidden")
        } else {
            recordBadge.classList.add("hidden")
        }
    }

    update_highscore_display()
    gameOverScreen.classList.remove("hidden")
}

/* --- ANIMATION DES POINTS --- */

function animate_points(addedPoints) {
    const targetPoints = totalpoints + addedPoints
    const startPoints = totalpoints
    totalpoints = targetPoints

    const display = document.getElementById("points_display")
    const duration = 1000
    const startTime = performance.now()

    function step(now) {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        const current = Math.round(startPoints + (targetPoints - startPoints) * (1 - (1 - progress) * (1 - progress)))
        
        if (display) display.innerText = `Points : ${current}`

        if (progress < 1) {
            requestAnimationFrame(step)
        }
    }

    requestAnimationFrame(step)
}

/* --- CHARGEMENT DES DONNÉES --- */

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

/* --- SUGGESTIONS --- */

function update_suggestions(query) {
    const suggestionsEl = document.getElementById("suggestions")
    if (!suggestionsEl) return

    const normQuery = normalize(query)
    if (normQuery.length === 0) {
        hide_suggestions()
        return
    }

    let matches = []
    searchCandidates.forEach(candidate => {
        const isMatch = candidate.searchTerms.some(term => term.includes(normQuery))
        if (isMatch) matches.push(candidate.display)
    })

    matches = [...new Set(matches)].slice(0, 6)

    if (matches.length === 0) {
        hide_suggestions()
        return
    }

    activeSuggestionIndex = -1
    suggestionsEl.innerHTML = matches.map((title, index) => `
        <div class="suggestion-item p-2 sm:p-2.5 hover:bg-primary/20 cursor-pointer font-medium text-xs sm:text-sm transition-colors border-b border-base-200 last:border-none flex items-center justify-between" 
            data-index="${index}" 
            onclick="select_suggestion('${title.replace(/'/g, "\\'")}')">
            <span class="truncate mr-2">${title}</span>
            <span class="text-[10px] sm:text-xs text-base-content/40 italic flex items-center gap-1 shrink-0">
                <svg class="w-3 h-3 text-base-content/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                Suggestion
            </span>
        </div>
    `).join('')

    suggestionsEl.classList.remove("hidden")
}

function select_suggestion(title) {
    const input = document.getElementById("video_title")
    if (input) input.value = title
    hide_suggestions()
}

function hide_suggestions() {
    const suggestionsEl = document.getElementById("suggestions")
    if (!suggestionsEl) return
    suggestionsEl.classList.add("hidden")
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

/* --- LOGIQUE DU GAMEPLAY --- */

function render_video_sidebar(videos) {
    const listContainer = document.getElementById("video_list")
    const countContainer = document.getElementById("video_count")

    if (countContainer) countContainer.innerText = videos.length
    if (listContainer) {
        listContainer.innerHTML = videos.map(v => {
            const titleFR = anglais_francais[v.title] || v.title
            return `
                <div class="flex items-center gap-3 p-2.5 hover:bg-base-200 rounded-xl transition-colors cursor-pointer" onclick="select_suggestion('${titleFR.replace(/'/g, "\\'")}')">
                    <img src="https://img.youtube.com/vi/${v.id}/default.jpg" class="w-16 h-11 object-cover rounded-md shadow shrink-0" alt="${titleFR}" />
                    <div class="flex-1 min-w-0">
                        <p class="font-semibold text-base truncate text-base-content" title="${titleFR}">${titleFR}</p>
                        <p class="text-xs text-base-content/60 font-mono flex items-center gap-1 mt-0.5">
                            <svg class="w-3.5 h-3.5 shrink-0 text-base-content/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>${seconds_to_hms(v.duration)}</span>
                        </p>
                    </div>
                </div>
            `
        }).join('')
    }
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
    
    const titleInput = document.getElementById("video_title")
    const timeInput = document.getElementById("time_input")
    titleInput.value = ""
    timeInput.value = ""
    timeInput.classList.remove("input-error")
    
    hide_suggestions()
    document.getElementById("suivant").classList.add("hidden")
    
    const nextBtn = document.getElementById("suivant")
    if (max_rounds > 0 && current_round >= max_rounds) {
        nextBtn.innerText = "Voir les résultats"
    } else {
        nextBtn.innerText = "Question suivante"
    }

    document.getElementById("button_title").classList.remove("hidden")
    titleInput.classList.remove("hidden")
    timeInput.classList.add("hidden")
    document.getElementById("button_time").classList.add("hidden")
    document.getElementById("video_player").classList.add("hidden")
    
    const hintBox = document.getElementById("video_info_hint")
    if (hintBox) {
        hintBox.innerHTML = ""
        hintBox.classList.add("hidden")
    }

    validated = false
    document.getElementById("result").innerHTML = ""

    setTimeout(() => titleInput.focus(), 100)
}


async function submit_title() {
    if (validated) return
    validated = true

    if (!is_game_started) {
        is_game_started = true
        const roundSelect = document.getElementById("round_select")
        if (roundSelect) roundSelect.disabled = true
    }

    hide_suggestions()
    const rawInput = document.getElementById("video_title").value
    const guessed_title = title_map[normalize(rawInput)]
    const expected_title = phrases[current_question[current_question.length >> 1]][0]

    const indcontext = close_phrases(current_question[current_question.length >> 1], 180)
    const expandedPhrase = indcontext.map(i => phrases[i][1].trim()).join(" ")
    const extended_start_time = phrases[indcontext[0]][2]

    let affichage = ""
    if (guessed_title && francais_anglais[guessed_title] === expected_title) {
        animate_points(200)
        affichage = `
            <div class="space-y-1">
                <p class="text-xl font-bold text-success">Bon titre ! (+200 pts)</p>
                <p class="text-base text-base-content/80">Vidéo : <strong>"${guessed_title}"</strong></p>
            </div>
        `
        
        document.getElementById("phrase").innerText = `« ... ${expandedPhrase.replace("\n", " ")} ... »`

        const totalDuration = durations[expected_title]
        const hintBox = document.getElementById("video_info_hint")
        if (hintBox) {
            hintBox.innerHTML = `
                <div class="inline-flex items-center gap-2 bg-base-200 text-primary px-4 py-1.5 rounded-full border border-base-300 text-sm font-semibold">
                    <svg class="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Durée totale :</span>
                    <span class="font-mono text-base-content">${seconds_to_hms(totalDuration)}</span>
                </div>
            `
            hintBox.classList.remove("hidden")
        }

        const timeInput = document.getElementById("time_input")
        timeInput.classList.remove("hidden")
        document.getElementById("button_time").classList.remove("hidden")
        setTimeout(() => timeInput.focus(), 100)
    } else {
        animate_points(0)
        affichage = `
            <div class="space-y-1">
                <p class="text-xl font-bold text-error">Mauvais titre ! (+0 pt)</p>
                <p class="text-base text-base-content/80">La vidéo était « <strong>${expected_title}</strong> » à <strong>${seconds_to_hms(extended_start_time)}</strong>.</p>
            </div>
        `
        
        document.getElementById("phrase").innerText = `« ... ${expandedPhrase.replace("\n", " ")} ... »`

        document.getElementById("video_player").innerHTML = get_html_yt(ids[expected_title], extended_start_time)
        document.getElementById("video_player").classList.remove("hidden")
        document.getElementById("suivant").classList.remove("hidden")
        
        // Permet de passer directement avec Entrée si on souhaite passer la relecture vidéo
        setTimeout(() => document.getElementById("suivant").focus(), 100)
    }

    document.getElementById("video_title").classList.add("hidden")
    document.getElementById("button_title").classList.add("hidden")
    document.getElementById("result").innerHTML = affichage
}

function submit_time() {
    const expected_title = phrases[current_question[current_question.length >> 1]][0]
    const guess_time_str = document.getElementById("time_input").value
    const secondsGuessed = hms_to_seconds(guess_time_str)
    const timeInput = document.getElementById("time_input")

    if (isNaN(secondsGuessed)) {
        timeInput.classList.add("input-error")
        return
    }

    timeInput.classList.remove("input-error")
    
    const indcontext = close_phrases(current_question[current_question.length >> 1], 180)
    const extended_start_time = phrases[indcontext[0]][2]
    
    const durationvideo = durations[expected_title]
    const score = score_guess_quadratic(secondsGuessed, extended_start_time, durationvideo)

    animate_points(score)

    // Affichage enrichi des points d'estimation sur l'écran du lecteur vidéo
    const resultHtml = `
        <div class="space-y-2 bg-base-200/50 p-4 rounded-xl border border-base-300">
            <div class="text-2xl font-black ${score > 0 ? 'text-success' : 'text-warning'}">
                + ${score} points
            </div>
            <div class="text-sm md:text-base text-base-content/90">
                Moment exact : <strong>${seconds_to_hms(extended_start_time)}</strong> 
                <span class="mx-1">•</span> Votre estimation : <strong>${seconds_to_hms(secondsGuessed)}</strong> 
                <span class="mx-1">•</span> Écart : <strong>${seconds_to_hms(Math.abs(extended_start_time - secondsGuessed))}</strong>
            </div>
        </div>
    `
    document.getElementById("result").innerHTML = resultHtml

    document.getElementById("video_player").innerHTML = get_html_yt(ids[expected_title], extended_start_time)
    document.getElementById("video_player").classList.remove("hidden")

    timeInput.classList.add("hidden")
    document.getElementById("button_time").classList.add("hidden")
    
    const nextBtn = document.getElementById("suivant")
    nextBtn.classList.remove("hidden")
    setTimeout(() => nextBtn.focus(), 100)
}

/* --- GESTION DE LA BARRE LATÉRALE --- */

function toggle_sidebar() {
    const sidebar = document.getElementById("sidebar")
    if (!sidebar) return
    sidebar.classList.toggle("collapsed")
}

document.addEventListener("DOMContentLoaded", () => {
    init_theme()
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

    // Raccourci Touche Entrée global pour passer à la manche suivante si le bouton est actif
    document.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const suivantBtn = document.getElementById("suivant")
            const isSuivantVisible = suivantBtn && !suivantBtn.classList.contains("hidden")
            
            if (isSuivantVisible) {
                // Si l'utilisateur n'est pas en train d'interagir avec les inputs
                if (document.activeElement !== titleInput && document.activeElement !== timeInput) {
                    e.preventDefault()
                    next_round()
                }
            }
        }
    })

    document.addEventListener("click", (e) => {
        if (!e.target.closest("#video_title") && !e.target.closest("#suggestions")) {
            hide_suggestions()
        }
    })

    load_data()
})