// --- CONFIGURATION DES SOUS-TITRES ET LANGUES ---
const LANG_CONFIG = {
    fr: {
        label: "Français",
        folders: ["French"]
    },
    en: {
        label: "English",
        folders: ["English"]
    }
}

const disabledByDefault=["Tous les boss de Dark Souls 3 d'affilée sans mourir"]


let transcriptsByLang = {}
let transcripts = {}
let rawVideos = []
let current_round=1
let max_rounds=15
let correct_titles_count = 0
let is_game_over=false
let is_game_started=false
let disabledVideos = new Set()
let durations, francais_anglais, anglais_francais, manual_aliases, title_map, phrases, current_question, ids, current_lang, ytPlayer, start_segment
let searchCandidates = []
let activeSuggestionIndex = -1
let totalpoints = 0
let validated = false
let authorize_blank=(localStorage.getItem("great_guess_blank") || "true")!=="false"
let totalquestions=[]
const difficulties = {
    normal: {
        fonction: normal_difficulty,
        sidebar: true,
        extend_context: true,
        suggestions: true,
        description: "Suggestions actives, extrait rallongé après réponse et liste des vidéos disponible."
    },
    hard: {
        fonction: hardcore_difficulty,
        sidebar: false,
        extend_context: true,
        suggestions: true,
        description: "Plus de liste de vidéos et plus de possibilité d'utiliser des raccourcis pour les vidéos. "
    },
    hardcore: {
        fonction: hardcore_difficulty,
        sidebar: false,
        extend_context: true,
        suggestions: false,
        description: "Le titre est demandé (plus de possibilité d'utiliser des raccourcis). Aucune aide visuelle. "
    },
    perfect: {
        fonction: perfect_difficulty,
        sidebar: false,
        extend_context: false,
        suggestions: false,
        description: "C'est le moment d'être parfaits : aucune aide, et le titre doit être correct au caractère près"
    }
}
let current_difficulty=localStorage.getItem("great_guess_difficulty") || "normal"


/* --- LOGIQUE DU GAMEPLAY --- */


function get_phrases(transcripts) {
    let out = []
    for (const [title, subs] of Object.entries(transcripts)) {
        // On ignore les vidéos masquées par l'utilisateur
        if (disabledVideos.has(title)) continue

        if (subs !== null && subs !== undefined && Array.isArray(subs)) {
            for (const sub of subs) {
                out.push([title, sub.text, sub.start, sub.duration])
            }
        }
    }
    return out
}

function close_phrases(ind, lengthMin) {
    const title = phrases[ind][0]
    let left = ind
    let right = ind
    let total = phrases[ind][1].length
    while (total < lengthMin) {
        let expanded = false
        if (left > 0 && phrases[left - 1][0] === title) {
            left--
            total += phrases[left][1].length
            expanded = true
        }
        if (total >= lengthMin) break
        if (right < phrases.length - 1 && phrases[right + 1][0] === title) {
            right++
            total += phrases[right][1].length
            expanded = true
        }
        if (!expanded) break
    }
    let renvoi = []
    for (let i = left; i <= right; i++) {
        renvoi.push(i)
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
    let maxError = videoDuration * Math.max(0.2,(0.80-0.5*((Math.max(0,videoDuration-300))/7200)**0.2))
    if (error >= maxError) return 0
    let errorRatio = error / maxError
    let score = 200 * Math.pow(1.02 - errorRatio, 1.4)
    return Math.round(Math.min(score, 200))
}

function new_question(focusInput = true) {
    if (transcriptsByLang[current_lang]) {
        transcripts = transcriptsByLang[current_lang]
        phrases = get_phrases(transcripts)
    }
    if (!phrases || phrases.length === 0) return
    const indices = get_question()
    current_question = indices

    const center_idx = current_question[current_question.length >> 1]
    window.current_quote_signature = {
        title: phrases[center_idx][0],
        start: phrases[center_idx][2]
    }
    const phrase = indices.map(i => phrases[i][1].trim()).join(" ")

    totalquestions.push({"phrase":phrase,"real_video":null,"real_time":window.current_quote_signature.start,"guessed_time":null,"guessed_video":null,"time_video":null,"time_moment":null,"score":0})
    start_segment=Date.now()
    
    document.getElementById("phrase").innerHTML = `« ${phrase.replace("\n", " ").replace("<i>",'<span class="not-italic">').replace("</i>","</span>")} »`
    
    const titleInput = document.getElementById("video_title")
    const timeInput = document.getElementById("time_input")
    titleInput.value = ""
    timeInput.value = ""
    timeInput.classList.remove("input-error")
    hide_suggestions()
    document.getElementById("suivant").classList.add("hidden")
    document.getElementById("video_title").classList.remove("input-error")
    
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
    const playerDiv = document.getElementById("video_player");
    playerDiv.className = "absolute -left-[9999px] opacity-0 pointer-events-none w-full";
    document.getElementById("time_wrapper").classList.add("hidden")
    document.getElementById("time_help_box").classList.add("hidden")
    
    const hintBox = document.getElementById("video_info_hint")
    if (hintBox) {
        hintBox.innerHTML = ""
        hintBox.classList.add("hidden")
    }

    validated = false
    document.getElementById("result").innerHTML = ""

    if (focusInput) {
        setTimeout(() => titleInput.focus(), 100)
    }
}

function normal_difficulty(rawInput,expectedTitle){
    const guessed_title = title_map[normalize(rawInput)]
    return (guessed_title && francais_anglais[guessed_title] === expectedTitle)
}
function hardcore_difficulty(rawInput,expectedTitle){
    return (overnormalyze(rawInput)===overnormalyze(anglais_francais[expectedTitle]))
}
function perfect_difficulty(rawInput,expected_title){
    return (rawInput===anglais_francais[expected_title])
}
function overnormalyze(title){
    return (title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, ""))
}
async function submit_title() {
    if (validated) return
    validated = true
    const video_input= document.getElementById("video_title")
    if (video_input.value.trim()==="" && !authorize_blank) {
        video_input.classList.add("input-error")
        return
    }
    video_input.classList.remove("input-error")
    if (window.background_load_promise) {
        const originalVal = titleInput.value
        titleInput.disabled = true
        
        await window.background_load_promise
        
        titleInput.disabled = false
        titleInput.value = originalVal
        if (validated) return 
    }
    if (!is_game_started) {
        is_game_started = true
        const roundSelect = document.getElementById("round_select")
        if (roundSelect) roundSelect.disabled = true
        const availableVideos = rawVideos.filter(v => {
            const subs = transcripts[v.title]
            return subs && Array.isArray(subs) && subs.length > 0
        })
        const refreshBtn = document.getElementById("refresh_videos")
        const settingsBtn=document.getElementById('settings_btn_header')
        const themeBtn=document.getElementById('theme_btn_header')
        if (settingsBtn) settingsBtn.classList.add('hidden');
        if (themeBtn) themeBtn.classList.remove('hidden');
        if (refreshBtn) refreshBtn.style.display = "none"
        if (availableVideos.length==0) console.log("erreur")
        render_video_sidebar(availableVideos)
    }

    hide_suggestions()
    const rawInput = document.getElementById("video_title").value
    const guessed_title = title_map[normalize(rawInput)]
    const expected_title = phrases[current_question[current_question.length >> 1]][0]
    const shouldExtend = difficulties[current_difficulty]?.extend_context ?? true
    const indcontext = shouldExtend 
        ? close_phrases(current_question[current_question.length >> 1], 180) 
        : current_question

    const expandedPhrase = indcontext.map(i => phrases[i][1].trim()).join(" ")
    const playback_start_time = phrases[indcontext[0]][2]

    totalquestions[totalquestions.length-1]["time_video"]=Date.now()-start_segment
    totalquestions[totalquestions.length-1]["guessed_video"]=guessed_title
    totalquestions[totalquestions.length-1]["real_video"]=anglais_francais[expected_title]
    start_segment=Date.now()

    // Formatage propre avec ellipsis uniquement en cas d'extension
    const formattedPhrase = shouldExtend ? `« ... ${expandedPhrase.replace("\n", " ")} ... »` : `« ${expandedPhrase.replace("\n", " ")} »`

    let affichage = ""
    if (difficulties[current_difficulty].fonction(rawInput,expected_title)) {
        correct_titles_count++
        animate_points(200)
        affichage = `
            <div class="space-y-1">
                <p class="text-xl font-bold text-success">Bon titre ! (+200 pts)</p>
                <p class="text-base text-base-content/80">Vidéo : <strong>"${guessed_title}"</strong></p>
            </div>
        `
        
        document.getElementById("phrase").innerText = formattedPhrase

        const totalDuration = durations[ids[expected_title]]
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
        if (!localStorage.getItem("time_helped")){
            const time_help = document.getElementById("time_help_box")
            if (time_help) time_help.classList.toggle("hidden")
            localStorage.setItem("time_helped",true)
        }
        document.getElementById("time_wrapper").classList.remove("hidden")

        const timeInput = document.getElementById("time_input")
        timeInput.classList.remove("hidden")
        document.getElementById("button_time").classList.remove("hidden")
        setTimeout(() => timeInput.focus(), 100)
    } else {
        animate_points(0)
        const userEntered=rawInput.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")
        affichage = `
            <div class="space-y-1">
                <p class="text-xl font-bold text-error">Mauvais titre ! (+0 pt)</p>
                <i class="text-base text-base-content/60">Votre réponse : « <strong>${userEntered}</strong> »</i>
                <p class="text-base text-base-content/80">La vidéo était « <strong>${anglais_francais[expected_title]}</strong> » à <strong>${seconds_to_hms(playback_start_time)}</strong>.</p>
            </div>
        `
        
        document.getElementById("phrase").innerText = `« ... ${expandedPhrase.replace("\n", " ")} ... »`

        play_video(expected_title, playback_start_time)
        document.getElementById("suivant").classList.remove("hidden")
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
    const exact_quote_start = phrases[current_question[0]][2]
    const shouldExtend = difficulties[current_difficulty]?.extend_context ?? true
    const indcontext = shouldExtend ? close_phrases(current_question[current_question.length >> 1], 180) : current_question
    const playback_start_time = phrases[indcontext[0]][2]
    
    const durationvideo = durations[ids[expected_title]]
    const score = score_guess_quadratic(secondsGuessed, exact_quote_start, durationvideo)
    totalquestions[totalquestions.length-1]["score"]=200+score
    totalquestions[totalquestions.length-1]["time_moment"]=Date.now()-start_segment
    totalquestions[totalquestions.length-1]["guessed_time"]=secondsGuessed

    animate_points(score)

    // Affichage enrichi des points d'estimation sur l'écran du lecteur vidéo
    const resultHtml = `
        <div class="space-y-2 bg-base-200/50 p-4 rounded-xl border border-base-300">
            <div class="text-2xl font-black ${score > 0 ? 'text-success' : 'text-warning'}">
                + ${score} points
            </div>
            <div class="text-sm md:text-base text-base-content/90">
                Moment exact : <strong>${seconds_to_hms(exact_quote_start)}</strong> 
                <span class="mx-1">•</span> Votre estimation : <strong>${seconds_to_hms(secondsGuessed)}</strong> 
                <span class="mx-1">•</span> Écart : <strong>${seconds_to_hms(Math.abs(exact_quote_start - secondsGuessed))}</strong>
            </div>
        </div>
    `

    play_video(expected_title, playback_start_time)
    
    document.getElementById("result").innerHTML = resultHtml

    document.getElementById("video_player").classList.remove("hidden")
    document.getElementById("time_wrapper").classList.add("hidden")
    document.getElementById("time_help_box").classList.add("hidden")
    timeInput.classList.add("hidden")
    document.getElementById("button_time").classList.add("hidden")
    
    const nextBtn = document.getElementById("suivant")
    nextBtn.classList.remove("hidden")
    setTimeout(() => nextBtn.focus(), 100)
}

/* --- CHARGEMENT DES DONNÉES --- */

async function load_language_transcripts(langKey) {
    const config = LANG_CONFIG[langKey]
    if (!config || !config.folders) return {}

    try {
        // 1. Récupération simultanée de tous les fichiers index.json des dossiers de la langue
        const indexPromises = config.folders.map(folder =>
            fetch(`myjson/transcripts/${folder}/index.json`)
                .then(res => res.ok ? res.json().then(fileList => ({ folder, fileList })) : null)
                .catch(() => null)
        )

        const folderIndices = (await Promise.all(indexPromises)).filter(Boolean)

        // 2. Création d'une liste unique contenant TOUTES les requêtes de sous-titres
        const filePromises = []
        folderIndices.forEach(({ folder, fileList }) => {
            fileList.forEach(filename => {
                filePromises.push(
                    fetch(`myjson/transcripts/${folder}/${filename}`)
                        .then(res => res.ok ? res.json() : null)
                        .catch(() => null)
                )
            })
        })

        // 3. Téléchargement simultané de TOUS les fichiers JSON de sous-titres
        const results = await Promise.all(filePromises)

        let mergedTranscripts = {}
        results.forEach(data => {
            if (data && typeof data === "object" && !Array.isArray(data)) {
                for (const [titleKey, subs] of Object.entries(data)) {
                    if (!Array.isArray(subs)) continue

                    const canonicalTitle = francais_anglais[titleKey] || titleKey
                    const cleanedSubs = subs.map(sub => {
                        const parsedStart = parseFloat(sub.start ?? sub.start_time ?? 0);
                        return {
                            text: sub.text || sub.content || "",
                            start: isNaN(parsedStart) ? 0 : parsedStart,
                            duration: parseFloat(sub.duration ?? sub.dur ?? 2.0)
                        };
                    }).filter(sub => sub.text.trim().length > 0);

                    mergedTranscripts[canonicalTitle] = cleanedSubs
                }
            }
        })

        return mergedTranscripts
    } catch (err) {
        console.warn(`Erreur lors du chargement de la langue : ${langKey}`, err)
        return {}
    }
}

async function load_data_background() {
    try {
        const langKeys = Object.keys(LANG_CONFIG)
        const langPromises = langKeys.map(lang => 
            load_language_transcripts(lang).then(transcripts => ({ lang, transcripts }))
        )

        const langResults = await Promise.all(langPromises)

        langResults.forEach(({ lang, transcripts }) => {
            transcriptsByLang[lang] = transcripts
        })

        // On assigne les vraies données
        transcripts = transcriptsByLang[current_lang] || {}
        title_map = build_title_aliases(transcripts, manual_aliases)
        phrases = get_phrases(transcripts)

        // --- CORRECTION : RÉCONCILIATION DE L'INDEX ---
        if (window.current_quote_signature && current_question) {
            const p = window.current_quote_signature
            const targetTitle = p.title // Le titre est déjà canonique, on l'utilise tel quel
            
            let foundIndex = -1
            for (let i = 0; i < phrases.length; i++) {
                if (phrases[i][0] === targetTitle && Math.abs(phrases[i][2] - p.start) < 0.1) {
                    foundIndex = i
                    break
                }
            }

            // On met à jour current_question pour que submit_title ne crashe pas
            if (foundIndex !== -1) {
                current_question = close_phrases(foundIndex, 50)
            }
        }

    } catch (err) {
        console.error("Erreur de chargement en tâche de fond :", err)
    }
}

function normalize(text) {
    return text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g,"").toLowerCase().trim() : ""
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
        let s = sMatch ? parseInt(sMatch[1], 10) : 0

        // Si aucun 'm' n'est présent mais qu'il y a des chiffres après le 'h' (ex: "1h15")
        if (!mMatch && hMatch) {
            const afterH = str.split("h")[1]
            const trailingDigits = afterH ? afterH.match(/^\s*(\d+)/) : null
            if (trailingDigits && !afterH.includes("s")) {
                m = parseInt(trailingDigits[1], 10)
            }
            else if (trailingDigits && afterH.includes("s")) {
                const sDigits = afterH.match(/(\d+)\s*s/)
                if (sDigits) {
                    s = parseInt(sDigits[1], 10)
                }
            }
        }
        if (!sMatch && mMatch) {
            const afterM = str.split("m")[1]
            const trailingDigits = afterM ? afterM.match(/^\s*(\d+)/) : null
            if (trailingDigits) {
                s = parseInt(trailingDigits[1], 10)
            }
        }

        return h * 3600 + m * 60 + s
    }

    if (str.includes(":")) {
        const parts = str.split(":").map(p => parseInt(p, 10))
        if (parts.some(isNaN)) return NaN;
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
        if (parts.length === 2) return parts[0] * 3600 + parts[1] *60
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
    correct_titles_count = 0
    current_round = 1
    is_game_over = false
    is_game_started = false

    // On efface la mémoire de la question courante
    window.current_quote_signature = null 

    const roundSelect = document.getElementById("round_select")
    if (roundSelect) roundSelect.disabled = false

    const refreshBtn = document.getElementById("refresh_videos")
    if (refreshBtn) refreshBtn.style.display = "inline-block"

    const display = document.getElementById("points_display")
    if (display) display.innerText = "Points : 0"

    disabledByDefault.forEach(title=>{
        disabledVideos.add(title)
    })

    update_round_display()
    update_highscore_display()
    update_difficulty_badges()

    document.getElementById("quiz_content").classList.remove("hidden")
    document.getElementById("game_over_screen").classList.add("hidden")

    const settingsBtn=document.getElementById('settings_btn_header')
    const themeBtn=document.getElementById('theme_btn_header')
    if (settingsBtn) settingsBtn.classList.remove('hidden');
    if (themeBtn) themeBtn.classList.add('hidden');
    refresh_active_pool()
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

// Message modifiable à souhait (supporte le **gras**)


function show_unlock_difficulty() {
    const message = "Mais c'est que vous êtes pro à ce jeu dis donc ! On va pouvoir corser ça un peu, allez voir la difficulté **Parfait** dans les paramètres 😼"
    const modal = document.getElementById("unlock_modal")
    const msgEl = document.getElementById("unlock_modal_message")
    if (!modal) return

    if (msgEl) {
        msgEl.innerHTML = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    }
    update_difficulty_options()
    modal.showModal()
}

function show_game_over() {
    is_game_over = true
    document.getElementById("quiz_content").classList.add("hidden")

    const isNewRecord = save_highscore(max_rounds, totalpoints)

    const justUnlocked=unlock_pro_function()
    if (justUnlocked){
        show_unlock_difficulty()
    }
    
    const gameOverScreen = document.getElementById("game_over_screen")
    const finalScoreEl = document.getElementById("final_score")
    const maxPossibleEl = document.getElementById("max_possible_score")
    const recordBadge = document.getElementById("new_record_badge")
    const bestScoreText = document.getElementById("end_best_score")
    const correctVideosEl = document.getElementById("correct_videos_count")
    const totalVideosEl = document.getElementById("total_videos_played")
    const progressBar = document.getElementById("score_progress_bar")

    const maxPossible = max_rounds * 400
    if (finalScoreEl) finalScoreEl.innerText = totalpoints
    if (maxPossibleEl) maxPossibleEl.innerText = maxPossible
    if (bestScoreText) bestScoreText.innerText = get_highscore(max_rounds)
    if (correctVideosEl) correctVideosEl.innerText = correct_titles_count
    if (totalVideosEl) totalVideosEl.innerText = max_rounds

    // Animation de la barre de progression
    if (progressBar) {
        progressBar.style.width = "0"
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
    if (totalpoints>500) sendResults()
}

/* --- GESTION DES HIGH SCORES (LOCAL STORAGE) --- */

function get_highscore_key(rounds,diff) {
    return `great_guess_highscore_${rounds}_${diff}`
}

function get_highscore(rounds,diff=current_difficulty) {
    return parseInt(localStorage.getItem(get_highscore_key(rounds,diff)) || "0", 10)
}

function save_highscore(rounds, score, diff = current_difficulty) {
    const current = get_highscore(rounds,diff)
    if (score > current) {
        localStorage.setItem(get_highscore_key(rounds,diff), score)
        return true
    }
    return false
}

function update_highscore_display() {
    const highscoreEl = document.getElementById("highscore_display")
    if (highscoreEl) {
        highscoreEl.innerText = get_highscore(max_rounds,current_difficulty)
    }
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

/* --- SUGGESTIONS --- */

function escape_title(str) {
    return str ? str.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;") : ""
}

function update_suggestions(query) {
    const suggestionsEl = document.getElementById("suggestions")
    if (!suggestionsEl || !difficulties[current_difficulty].suggestions) return

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
            onclick="select_suggestion('${escape_title(title)}')">
            <span class="truncate mr-2">${title}</span>
            <span class="text-[10px] sm:text-xs text-base-content/40 italic flex items-center gap-1 shrink-0">
                <svg class="w-3 h-3 text-base-content/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
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

/* --- GESTION DE LA BARRE LATÉRALE --- */

function toggle_sidebar() {
    const sidebar = document.getElementById("sidebar")
    if (!sidebar) return
    const refreshBtn = document.getElementById("refresh_videos")
    if (refreshBtn) refreshBtn.style.display = sidebar.classList.contains("collapsed") ? "inline-block" : "none"
    sidebar.classList.toggle("collapsed")
}

async function toggle_video_status(videoTitle) {
    if (window.background_load_promise) await window.background_load_promise
    if (is_game_started) return
    const availableVideos = rawVideos.filter(v => {
        const subs = transcripts[v.title]
        return subs && Array.isArray(subs) && subs.length > 0
    })

    const activeCount = availableVideos.length - disabledVideos.size

    if (!disabledVideos.has(videoTitle)) {
        // Tentative de désactivation : vérifier la contrainte d'au moins 1 vidéo active
        if (activeCount == 1) {
            alert("Il doit y avoir au moins une vidéo active pour jouer.")
            return
        }
        disabledVideos.add(videoTitle)
    } else {
        // Réintégration
        disabledVideos.delete(videoTitle)
    }

    // Ré-actualisation des répliques, de la recherche et de la sidebar
    refresh_active_pool()
}

function refresh_active_pool() {
    const availableVideos = rawVideos.filter(v => {
        const subs = transcripts[v.title]
        return subs && Array.isArray(subs) && subs.length > 0
    })
    
    const activeVideos = availableVideos.filter(v => !disabledVideos.has(v.title))
    searchCandidates = build_search_candidates(activeVideos, manual_aliases, anglais_francais)

    // 1. Filtrer les sous-titres pour ne garder que les vidéos actives
    const activeTranscripts = {}
    activeVideos.forEach(v => {
        if (transcripts[v.title]) {
            activeTranscripts[v.title] = transcripts[v.title]
        }
    })
    phrases = get_phrases(activeTranscripts)
    render_video_sidebar(availableVideos)
    new_question(false)
}

function render_video_sidebar(videos) {
    const sidebarEl = document.getElementById("sidebar")
    const listContainer = document.getElementById("video_list")
    const countContainer = document.getElementById("video_count")

    if (!difficulties[current_difficulty].sidebar) {
        if (sidebarEl) sidebarEl.style.display = "none"
        return
    } else {
        if (sidebarEl) sidebarEl.style.display = ""
    }

    const activeVideos = videos.filter(v => !disabledVideos.has(v.title))
    const inactiveVideos = videos.filter(v => disabledVideos.has(v.title))

    if (countContainer) {
        countContainer.innerText = `${activeVideos.length}/${videos.length}`
    }

    if (!listContainer) return

    const renderCard = (v, isDisabled) => {
        const titleFR = anglais_francais[v.title] || v.title
        const safeTitle = escape_title(v.title)
        const safeTitleFR = escape_title(titleFR)
        const isLastActive = !isDisabled && activeVideos.length === 1

        return `
            <div class="group relative flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                isDisabled 
                    ? "bg-base-200/40 opacity-50 grayscale hover:opacity-80" 
                    : "hover:bg-base-200"
            }">
                <img src="https://img.youtube.com/vi/${v.id}/default.jpg" 
                    class="w-16 h-11 object-cover rounded-md shadow shrink-0 cursor-pointer" 
                    alt="${safeTitleFR}"
                    onclick="${isDisabled ? '' : `select_suggestion('${safeTitleFR}')`}" />
                
                <div class="flex-1 min-w-0 cursor-pointer" onclick="${isDisabled ? '' : `select_suggestion('${safeTitleFR}')`}">
                    <p class="font-semibold text-sm truncate text-base-content" title="${titleFR}">${titleFR}</p>
                    <p class="text-xs text-base-content/60 font-mono flex items-center gap-1 mt-0.5">
                        <svg class="w-3.5 h-3.5 shrink-0 text-base-content/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>${seconds_to_hms(v.duration)}</span>
                    </p>
                </div>

                <!-- Afficher les boutons uniquement si la partie n'a PAS commencé -->
                ${!is_game_started && !isLastActive ? `
                    <button onclick="toggle_video_status('${safeTitle}')" 
                            class="p-1 rounded-full transition-all shrink-0 ${
                                isDisabled 
                                    ? "text-success hover:bg-success/20" 
                                    : "text-base-content/60 hover:text-error hover:bg-error/20"
                            }" 
                            title="${isDisabled ? 'Réintégrer cette vidéo' : 'Retirer cette vidéo'}">
                        ${isDisabled ? `
                            <svg class="w-5 h-5 block" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="9"/>
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v8m-4-4h8"/>
                            </svg>
                        ` : `
                            <svg class="w-5 h-5 block" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="9"/>
                                <path stroke-linecap="round" stroke-linejoin="round" d="M8 8l8 8M16 8l-8 8"/>
                            </svg>
                        `}
                    </button>
                ` : ''}
            </div>
        `
    }

    let html = activeVideos.map(v => renderCard(v, false)).join('')

    if (inactiveVideos.length > 0) {
        html += `
            <div class="pt-3 mt-3 border-t border-base-300">
                <p class="text-[11px] font-bold uppercase tracking-wider text-base-content/40 mb-2 px-1">
                    Vidéos masquées (${inactiveVideos.length})
                </p>
                <div class="space-y-2">
                    ${inactiveVideos.map(v => renderCard(v, true)).join('')}
                </div>
            </div>
        `
    }

    listContainer.innerHTML = html
}

/* --- GESTION DE L'AIDE POUR LE TEMPS --- */

function toggle_time_help(event) {
    if (event) event.stopPropagation()
    const box = document.getElementById("time_help_box")
    if (box) box.classList.toggle("hidden")
}

/* --- GESTION DE LA LANGUE --- */

function change_language(newLang) {
    disabledVideos.clear()
    current_lang = newLang
    localStorage.setItem("great_guess_language", newLang)
    
    // 1. Récupération des sous-titres fusionnés pour la langue choisie
    transcripts = transcriptsByLang[current_lang] || {}

    // 2. Génération des alias et des répliques
    title_map = build_title_aliases(transcripts, manual_aliases)
    phrases = get_phrases(transcripts)

    // 3. Filtrer uniquement les vidéos présentes dans ce set de sous-titres
    const availableVideos = rawVideos.filter(v => {
        const subs = transcripts[v.title]
        return subs !== null && subs !== undefined && Array.isArray(subs) && subs.length > 0 && !(disabledVideos.has(v.title))
    })

    // 4. Mise à jour de la recherche et de la sidebar
    searchCandidates = build_search_candidates(availableVideos, manual_aliases, anglais_francais)
    render_video_sidebar(availableVideos)

    // 5. Réinitialisation de la partie
    reset_game()
}
function confirm_language_change(newLang) {
    const selectEl = document.getElementById("lang_select")

    if (is_game_started && !is_game_over) {
        const confirmChange = confirm(
            "Attention : Changer de langue réinitialisera votre partie en cours et vos points accumulés. Voulez-vous continuer ?"
        )
        if (!confirmChange) {
            if (selectEl) {
                selectEl.value = current_lang
                // Force le navigateur à détruire et réinitialiser le composant natif
                selectEl.disabled = true
                setTimeout(() => {
                    selectEl.disabled = false
                }, 50)
            }
            return
        }
    }

    change_language(newLang)
}

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
        document.getElementById("theme_toggle").checked=false
    } else {
        if (sunIcon) sunIcon.classList.add("hidden")
        if (moonIcon) moonIcon.classList.remove("hidden")
        document.getElementById("theme_toggle").checked=true
    }
}

function toggle_theme() {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "dark"
    const newTheme = currentTheme === "dark" ? "light" : "dark"
    apply_theme(newTheme)
}

/* GESTION DES DIFFICULTÉS */

function update_difficulty_description() {
    const descEl = document.getElementById("difficulty_description")
    if (descEl && difficulties[current_difficulty]) {
        descEl.innerText = difficulties[current_difficulty].description
    }
}

function change_difficulty(new_difficulty) {
    if (difficulties[new_difficulty]) {
        current_difficulty = new_difficulty
        localStorage.setItem("great_guess_difficulty", current_difficulty)
        update_difficulty_description()
        update_highscore_display()
        const availableVideos = rawVideos.filter(v => {
            const subs = transcripts[v.title]
            return subs && Array.isArray(subs) && subs.length > 0
        })
        render_video_sidebar(availableVideos)
        if (!difficulties[current_difficulty].suggestions) {
            hide_suggestions()
        }
        update_difficulty_badges()
        new_question()
    }
}

function update_difficulty_options() {
    const select = document.getElementById("difficulty_select")
    if (!select) return

    let perfectOption = select.querySelector("option[value='perfect']")

    if (is_extra_difficulty_unlocked()) {
        if (!perfectOption) {
            perfectOption = document.createElement("option")
            perfectOption.value = "perfect"
            perfectOption.innerText = "Parfait"
            select.appendChild(perfectOption)
        }
    } else if (perfectOption) {
        perfectOption.remove()
    }
    select.value = current_difficulty
    update_difficulty_description()
}

function unlock_pro_function(){
    if (max_rounds===15 && totalpoints>=4000){
        const wasUnlocked = is_extra_difficulty_unlocked()
        localStorage.setItem("great_guess_unlocked", "true")
        return !wasUnlocked
    }
    return false
}

function is_extra_difficulty_unlocked() {
    return localStorage.getItem("great_guess_unlocked") === "true"
}

function toggle_blank(){
    authorize_blank=authorize_blank?false:true
    localStorage.setItem("great_guess_blank",authorize_blank)
}

function update_difficulty_badges(difficulty=current_difficulty) {
    const quizBadge = document.getElementById('difficulty_badge_quiz');
    const endBadge = document.getElementById('end_difficulty_badge');

    if (!quizBadge || !endBadge) return;

    // Si la difficulté est "normale", on masque les badges
    if (difficulty === 'normal') {
        quizBadge.classList.add('hidden');
        endBadge.classList.add('hidden');
        return;
    }

    let badgeHTML = '';

    switch (difficulty) {
        case 'hard':
            badgeHTML = `
                <span class="badge font-bold gap-1 px-3 py-2 text-xs uppercase tracking-wider bg-orange-500/15 text-orange-500 border-orange-500/30">
                    Difficile
                </span>`;
            break;

        case 'hardcore':
            badgeHTML = `
                <span class="badge badge-error font-bold gap-1 px-3 py-2 text-xs uppercase tracking-wider shadow-sm">
                    Hardcore
                </span>`;
            break;

        case 'perfect':
        case 'parfait':
            badgeHTML = `
                <span class="badge font-black gap-1 px-3 py-2 text-xs uppercase tracking-wider bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-amber-950 border-amber-300 shadow-md">
                    Parfait
                </span>`;
            break;
    }

    // Mise à jour des contenus et affichage
    quizBadge.innerHTML = badgeHTML;
    quizBadge.classList.remove('hidden');

    endBadge.innerHTML = badgeHTML;
    endBadge.classList.remove('hidden');
}

/* Sending results */



async function sendResults() {
    const payload = {
        score: totalpoints,
        removed: Array.from(disabledVideos),
        correct_titles: correct_titles_count,
        amount_rounds: max_rounds,
        questions:totalquestions,
        difficulty:current_difficulty,
        language:current_lang,
        allows_blank:authorize_blank ? 1:0
    };

    try {
        const response = await fetch("https://thegreatguess.hrlupa0.workers.dev/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.status === 429) {
            console.warn("No results stored : Less than 2 minutes since last result");
        }
    } catch (err) {
        console.error("Error with result storage", err);
    }
}

function onYouTubeIframeAPIReady() {
    ytPlayer = new YT.Player('ytPlayer');
}
function play_video(expected_title, startTime) {
    const videoId = ids[expected_title];
    if (!videoId) {
        console.warn(`Video ID not found for title: "${expected_title}"`);
        return;
    }
    const validStartTime = (isNaN(startTime) || startTime < 0) ? 0 : Math.floor(startTime);

    const playerDiv = document.getElementById("video_player");
    if (playerDiv) {
        playerDiv.classList.remove("hidden");
        playerDiv.className = "flex justify-center w-full relative opacity-100 pointer-events-auto";
    }
    setTimeout(() => {
        if (ytPlayer && typeof ytPlayer.cueVideoById === "function") {
            try {
                ytPlayer.cueVideoById({
                    videoId: videoId,
                    startSeconds: validStartTime
                });
            } catch (err) {
                console.error("Error cueing YouTube video:", err);
            }
        }
    }, 50);
}

/* --- CHARGEMENT RAPIDE & LAZY LOADING --- */
function get_first_random_file(fileList, durations) {
    const weightedFiles = fileList.map(filename => {
        const videoId = filename.replace(".json", "")
        const weight = durations[videoId] || 0
        return { filename, weight }
    })

    const totalWeight = weightedFiles.reduce((sum, f) => sum + f.weight, 0)
    let randomWeight = Math.random() * totalWeight

    for (const item of weightedFiles) {
        if (randomWeight < item.weight) {
            return item.filename
        }
        randomWeight -= item.weight
    }

    return fileList[0] || ""
}

function transition_high_scores(){
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (/^great_guess_highscore_\d*$/.test(key)) {
            const rounds=key.replace("great_guess_highscore_","")
            save_highscore(rounds,localStorage.getItem(key))
            localStorage.removeItem(key)
        }
    }
}

async function first_load() {
    const titleInput = document.getElementById("video_title")
    if (titleInput) titleInput.focus()

    let resolveBg
    window.background_load_promise = new Promise(res => { resolveBg = res })

    const refreshBtn = document.getElementById('refresh_videos');
    const icon = refreshBtn.querySelector('svg');
    if (refreshBtn) refreshBtn.disabled = true;
    if (icon) icon.classList.add('animate-spin');

    try {
        
        const langConfig = LANG_CONFIG[current_lang] || LANG_CONFIG["fr"]
        const folder = langConfig.folders[0]

        const [videosRes, statiquesRes, stateRes, indexRes] = await Promise.all([
            fetch("myjson/videos.json"),
            fetch("myjson/statiques.json"),
            fetch("myjson/transcripts/current_state.json"),
            fetch(`myjson/transcripts/${folder}/index.json`)
        ])
        
        const videosJson = await videosRes.json()
        const statiques = await statiquesRes.json()
        const stateData = await stateRes.json()
        const fileList = await indexRes.json()

        rawVideos = videosJson.entries[0].entries

        francais_anglais = statiques.francais_anglais || {}
        manual_aliases = statiques.manual_aliases || {}
        anglais_francais = {}
        for (const [fr, en] of Object.entries(francais_anglais)) { anglais_francais[en] = fr }
        durations = {}
        ids = {}
        rawVideos.forEach(v => {
            durations[v.id] = v.duration
            ids[v.title] = v.id
            if (anglais_francais[v.title]) ids[anglais_francais[v.title]] = v.id
            if (francais_anglais[v.title]) ids[francais_anglais[v.title]] = v.id
        })

        disabledVideos.clear()
        disabledByDefault.forEach(title => disabledVideos.add(title))
        const shortcut_to_extended={"en":"English","fr":"French"}
        const langState = stateData[shortcut_to_extended[current_lang]] || { manual: [], automatic: [] }
        const validTitles = new Set([...langState.manual, ...langState.automatic])
        const availableVideos = rawVideos.filter(v => {
            const titleFR = anglais_francais[v.title] || v.title
            return validTitles.has(v.title) || validTitles.has(titleFR)
        })
        const activeVideos = availableVideos.filter(v => !disabledVideos.has(v.title))
        render_video_sidebar(availableVideos)
        searchCandidates = build_search_candidates(activeVideos, manual_aliases, anglais_francais)
        const randomFile = get_first_random_file(fileList,durations)
        const transcriptRes = await fetch(`myjson/transcripts/${folder}/${randomFile}`)
        const transcriptData = await transcriptRes.json()

        let initialTranscripts = {}
        for (const [titleKey, subs] of Object.entries(transcriptData)) {
            if (!Array.isArray(subs)) continue
            const canonicalTitle = francais_anglais[titleKey] || titleKey
            initialTranscripts[canonicalTitle] = subs.map(sub => ({
                text: sub.text || sub.content || "",
                start: parseFloat(sub.start ?? sub.start_time ?? 0),
                duration: parseFloat(sub.duration ?? sub.dur ?? 2.0)
            })).filter(sub => sub.text.trim().length > 0)
        }
        
        // Plus de risque d'écrasement, on assigne directement
        transcripts = initialTranscripts
        title_map = build_title_aliases(transcripts, manual_aliases)
        phrases = get_phrases(transcripts)

        // 4. Afficher la question INSTANTANÉMENT
        if (!window.current_quote_signature) {
            const savedText = titleInput ? titleInput.value : ""
            
            new_question() 
            
            if (titleInput) {
                if (savedText) {
                    titleInput.value = savedText
                    update_suggestions(savedText)
                }
                setTimeout(() => titleInput.focus(), 100)
            }
        }

        // 5. ENFIN, on lance le chargement lourd !
        // La bande passante est maintenant 100% disponible pour lui.
        load_data_background().finally(() => {
            resolveBg()
            window.background_load_promise = null
            if (refreshBtn) refreshBtn.disabled = false
            if (icon) icon.classList.remove('animate-spin')
        })
    } catch (error) {
        console.error("Erreur first_load :", error)
        resolveBg() // On libère le jeu en cas d'erreur
        window.background_load_promise = null
        refreshBtn.disabled = false;
        icon.classList.remove('animate-spin')
    }

}

function open_settings_modal() {
    update_difficulty_options()
    const modal = document.getElementById("settings_modal");
    if (modal) modal.showModal();
}



document.addEventListener("DOMContentLoaded", () => {
    current_lang = localStorage.getItem("great_guess_language") || document.getElementById("lang_select").value
    document.getElementById("lang_select").value=current_lang

    transition_high_scores()
    update_difficulty_options()
    const allowBlankToggle = document.getElementById("allow_blank")
    if (allowBlankToggle) allowBlankToggle.checked = authorize_blank

    init_theme()
    update_highscore_display()
    update_difficulty_badges()
    const titleInput = document.getElementById("video_title")
    const timeInput = document.getElementById("time_input")

    if (titleInput) {
        titleInput.addEventListener("input", (e) => update_suggestions(e.target.value))
        titleInput.addEventListener("keydown", handle_title_keydown)
        titleInput.addEventListener("focus", function () {
            setTimeout(() => this.select(), 0);
        })
    }

    if (timeInput) {
        timeInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") submit_time()
        })
    }

    document.getElementById("refresh_videos")?.addEventListener("click", () => {
        if (is_game_started || window.background_load_promise) return;
        disabledVideos.clear();
        disabledByDefault.forEach(title => {
            disabledVideos.add(title);
        });
        refresh_active_pool();
    });

    // Raccourci Touche Entrée global pour passer à la manche suivante si le bouton est actif
    document.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const suivantBtn = document.getElementById("suivant")
            const isSuivantVisible = suivantBtn && !suivantBtn.classList.contains("hidden")
            
            if (isSuivantVisible) {
                // Si l'utilisateur n'est pas en train d'interagir avec les inputs
                if (document.activeElement !== titleInput && document.activeElement !== timeInput) {
                    e.preventDefault()
                    e.stopPropagation()
                    next_round()
                }
            }
        }
    })

    document.addEventListener("click", (e) => {
        if (!e.target.closest("#video_title") && !e.target.closest("#suggestions") && !e.target.closest("#time_help_box")) {
            hide_suggestions()
        }
        const helpBox = document.getElementById("time_help_box")
        if (helpBox && !helpBox.classList.contains("hidden")) {
            if (!e.target.closest("#time_help_box") && !e.target.closest("button[onclick*='toggle_time_help']")) {
                helpBox.classList.add("hidden")
            }
        }
    })
    first_load()
})
