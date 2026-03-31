// i18n.ts — نظام الترجمة العربي الكامل مع الإضافات الجديدة (بدون تكرار)
// UTF-8 encoding — لا تعدّل الـ encoding

export const ARABIC_FONT_FAMILY = "'Tajawal', 'Cairo', 'Arial', sans-serif";
export const UI_FONT_FAMILY = ARABIC_FONT_FAMILY;

export const ar = {
    appTitle: "المنظمة السرية",

    phases: {
        WAITING:      "بانتظار البدء",
        LOBBY:        "الردهة",
        DAY:          "النهار",
        NIGHT:        "الليل",
        VOTING:       "التصويت",
        NIGHT_REVIEW: "مراجعة الليل",
        GAME_OVER:    "انتهت اللعبة",
    },

    roles: {
        ADMIN:      "الأدمن",
        MAFIA:      "المافيا",
        DOCTOR:     "الطبيب",
        DETECTIVE:  "المحقق",
        CITIZEN:    "المواطن",
        SPECTATOR:  "المشاهد",
    },

    lobby: {
        // ─── اتصال ───
        reconnecting:         "جارٍ إعادة الاتصال...",
        welcomeBack:          (username: string) => `مرحباً بعودتك يا ${username}`,
        startingNewSession:   "جارٍ بدء جلسة جديدة...",
        connectionTimeout:    "انتهت مهلة الاتصال",
        cannotConnect:        "تعذر الاتصال بالخادم",

        // ─── شاشة البداية ───
        enterSociety:         "الدخول إلى المنظمة السرية",
        joinQueue:            "انضم الآن",
        connecting:           "جارٍ الاتصال...",
        searching:            "جارٍ البحث...",
        joining:              "جارٍ الانضمام...",
        waitingForPlayers:    "بانتظار بقية اللاعبين...",
        connected:            "تم الاتصال بالخادم",

        // ─── أدوار ───
        rolePlayer:           "لاعب",
        roleSpectator:        "مشاهد",
        roleAdmin:            "أدمن",
        roleUnlocked:         "تم فتح اللعب، اختر لاعب",

        // ─── أدمن ───
        adminReady:           "لوحة الأدمن جاهزة",
        adminJoining:         "جارٍ الدخول كأدمن...",
        resetServerButton:    "إعادة ضبط الخادم",
        resetServerConfirm:   "سيتم طرد جميع اللاعبين ومسح الجلسة بالكامل. هل أنت متأكد؟",

        // ─── مشاهد ───
        spectatorJoining:     "جارٍ البحث عن لعبة نشطة...",

        // ─── لاعب ───
        playerJoining:        "جارٍ الانضمام إلى الطابور...",
        playerPasswordRequired:"اختر لاعب ثم أدخل كلمة السر أولاً",

        // ─── طابور ───
        queueCount:           (size: number, required: number) => `• في الطابور: ${size} / ${required}`,

        // ─── كلمة السر ───
        passwordSet:          (password: string) => `تم حفظ كلمة السر: ${password}`,
        noPassword:           "لا توجد كلمة سر للجلسة",
        sessionReset:         "تم تغيير كلمة السر، أدخل الكلمة الجديدة للمتابعة",
        serverReset:          "تمت إعادة ضبط الخادم من الأدمن",

        // ─── مدخلات ───
        usernameLabel:        "اسم المستخدم",
        usernameMin:          "الاسم يجب أن يكون حرفين على الأقل",
        joinAsLabel:          "طريقة الدخول",

        // ─── بطاقة اللوبي ───
        cardTag:              "المنظمة السرية",
        subtitle:             "لعبة جماعية في الخداع والاستنتاج",
        tagline:              "اخدع. استنتج. وابقَ حياً.",
        featureHiddenRoles:   "أدوار مخفية",
        featureStrategicVoting:"تصويت استراتيجي",
        featureNightElimination:"إقصاء ليلي",

        // ─── ترجمات إضافية للوبي (جديدة) ───
        playersTab:           "اللاعبون",
        eventsTab:            "الأحداث",
        chatTab:              "الدردشة",
        adminAccess:          "دخول الأدمن",
        adminPassword:        "أدخل كلمة سر الأدمن للمتابعة",
        cancel:               "إلغاء",
        confirm:              "تأكيد",
        sessionSettings:      "إعدادات الجلسة",
        setSession:           "تعيين كلمة السر وعدد اللاعبين للجلسة",
        passwordLabel:        "كلمة السر",
        playerCountLabel:     "عدد اللاعبين",
        joinAsPlayer:         "الدخول كلاعب",
        sessionPasswordPlaceholder: "كلمة سر الجلسة...",
        rejoinCodeLabel:      "كود إعادة الانضمام",
        rejoinNamePlaceholder:"اسم المستخدم...",
        codePlaceholder:      "6 أرقام",
        selectReplacementRole:"اختر دور اللاعب البديل",
    },

    night: {
        room:                 (roomId: string) => `الغرفة ${roomId}`,
        nightPhase:           "مرحلة الليل",

        // ─── تسميات الأدوار ───
        mafiaRoleLabel:       "المافيا",
        doctorRoleLabel:      "الطبيب",
        detectiveRoleLabel:   "المحقق",

        // ─── مافيا ───
        mafiaTitle:           "اختر هدفك",
        mafiaDeadTitle:       "لقد خرجت من اللعبة",
        mafiaSubtitle:        "نسّق مع فريقك ثم ثبّت الهدف",
        mafiaDeadSubtitle:    "راقب تخطيط المافيا من بعيد",
        mafiaSuggested:       "تم اقتراح الهدف",
        mafiaSuggest:         "اقترح",
        mafiaChannel:         "قناة المافيا",
        mafiaSystemSuggested: (from: string, target: string) => `${from} اقترح استهداف ${target}`,

        // ─── طبيب ───
        doctorTitle:          "من تريد حمايته؟",
        doctorSubtitle:       "احمِ لاعباً واحداً من هجوم المافيا الليلة",
        doctorProtect:        "احمِه",
        doctorSaving:         "جارٍ الحماية",
        doctorProtected:      "تمت الحماية",
        doctorProtecting:     (username: string) => `أنت تحمي ${username}`,

        // ─── محقق ───
        detectiveTitle:       "حقّق مع مشتبه به",
        detectiveSubtitle:    "اكشف هوية لاعب واحد هذه الليلة",
        detectiveInspect:     "حقّق",
        detectiveScanning:    "جارٍ التحقيق",
        detectiveInvestigating:(username: string) => `جارٍ التحقيق مع ${username}`,

        // ─── عام ───
        noTargets:            "لا يوجد أهداف متاحة",
        noPlayers:            "لا يوجد لاعبون متاحون",
        noSuspects:           "لا يوجد مشتبه بهم حالياً",
        you:                  "أنت",
        eliminatedNight:      (username: string) => `تم قتل ${username} أثناء الليل`,
        failedSave:           (username: string) => `فشلت الحماية، قُتل ${username}`,

        // ─── ترجمات إضافية للقناة والدردشة في الليل ───
        typeMessage:          "اكتب رسالة...",
        send:                 "إرسال",
    },

    game: {
        // ─── تبويبات ───
        players:              "اللاعبون",
        stats:                "الإحصاءات",
        timeline:             "التسلسل",
        events:               "الأحداث",
        chat:                 "الدردشة",
        live:                 "مباشر",

        // ─── غرفة ───
        room:                 (roomId: string) => `الغرفة ${roomId}`,
        round:                (round: number) => `الجولة ${round}`,

        // ─── تصويت ───
        voteTie:              "تعادل في التصويت، لم يُقصَ أحد",
        voteEliminated:       (username: string) => `تم إقصاء ${username} بالتصويت`,

        // ─── لعبة ───
        newGameStarting:      "تبدأ لعبة جديدة...",
        nightStory:           (story: string) => `القصة: ${story}`,
        waitingForAdmin:      "بانتظار الأدمن لبدء لعبة جديدة...",

        // ─── أخطاء ───
        doctorSelectionError: "اختيار الطبيب غير صالح",
        mafiaSelectionError:  "اختيار المافيا غير صالح",

        // ─── صوت ───
        voiceMicDenied:       "تم رفض إذن الميكروفون",
        voiceFailed:          "تعذر تشغيل الصوت",
        voiceClickToUnmute:   "اضغط لإلغاء الكتم",
        voiceClickToMute:     "اضغط لكتم الميكروفون",

        // ─── نتائج ───
        winner:               "الفائز",
        roundsPlayed:         "الجولات",
        gameDuration:         "مدة اللعبة",
        nightKills:           "قتلى الليل",
        doctorSaves:          "إنقاذات الطبيب",
        votedOut:             "المقصيون بالتصويت",
        voteTies:             "تعادلات التصويت",
        noEventsRecorded:     "لا توجد أحداث مسجلة",
        noValue:              "—",
        roleResultWinnerMafia:    "المافيا",
        roleResultWinnerCitizens: "المواطنون",
        roundLabel:           (round: number) => `الجولة ${round}`,

        // ─── أدمن ───
        adminPanel:           "لوحة الأدمن",
        close:                "إغلاق",
        rejoin:               "إعادة الانضمام",
        rejoinCode:           "رمز إعادة الانضمام",
        selectReplacementRole:"اختر دور اللاعب البديل ثم ولّد الرمز",
        generateCode:         "توليد الرمز",
        generating:           "جارٍ التوليد...",
        newCode:              "رمز جديد",
        validFor15Minutes:    "صالح لمدة 15 دقيقة",
        phaseControls:        "التحكم بالمراحل",
        startNight:           "ابدأ الليل",
        endNight:             "إنهاء الليل",
        startVoting:          "ابدأ التصويت",
        stopVoting:           "إيقاف التصويت",
        forceEnd:             "إنهاء فوري",
        restart:              "إعادة التشغيل",
        nightActions:         "إجراءات الليل",
        waiting:              "بانتظار التنفيذ",
        completedBy:          (username: string) => `تم بواسطة ${username}`,
        nightResults:         "نتائج الليل",
        tonightStory:         "قصة الليلة",
        writeTonightStory:    "اكتب ما حدث هذه الليلة...",
        revealStory:          "اعرض القصة للجميع",
        mafiaTarget:          "هدف المافيا",
        doctorSaved:          "إنقاذ الطبيب",
        finalVictim:          "الضحية النهائية",
        protected:            "تمت الحماية",

        // ─── ترجمات إضافية للعبة (جديدة، غير مكررة) ───
        playersTab:           "اللاعبون",
        eventsTab:            "الأحداث",
        chatTab:              "الدردشة",
        messagePlaceholder:   "اكتب رسالة...",
        voteToEliminate:      "صوِّت للإقصاء",
        voteSubtitle:         "اختر من يهدد المجتمع",
        votes:                "الأصوات",
        watching:             "مشاهد",
        vote:                 "صوِّت",
        you:                  "أنت",
        votingDiscussion:     "نقاش التصويت",
        discussBeforeVote:    "ناقش قبل التصويت",
        yourOpinion:          "رأيك...",
        yourTarget:           "هدفك",
        outcome:              "النتيجة",
        youProtected:         "لقد حميت",
        nightVictim:          "ضحية الليل",
        tapToDismiss:         "اضغط للإغلاق",
        mafiaConfirmed:       "مافيا مؤكد",
        innocentCitizen:      "مواطن بريء",
        mafiaWins:            "المافيا تفوز",
        citizensWin:          "المواطنون يفوزون",
        rounds:               "الجولات",
        duration:             "المدة",
    },

    admin: {
        panelTitle:          "لوحة التحكم",
        phaseControls:       "التحكم بالمراحل",
        startNight:          "ابدأ الليل",
        endNight:            "أنهِ الليل",
        startVoting:         "ابدأ التصويت",
        endVoting:           "أوقف التصويت",
        forceEnd:            "إنهاء فوري",
        restart:             "إعادة التشغيل",
        resetServer:         "إعادة ضبط الخادم",
        nightActions:        "إجراءات الليل",
        nightResults:        "نتائج الليل",
        tonightStory:        "قصة الليلة",
        writeTonightStory:   "اكتب ما حدث هذه الليلة...",
        revealStory:         "اعرض القصة للجميع",
        rejoinCode:          "كود إعادة الانضمام",
        generateCode:        "توليد الكود",
        close:               "إغلاق",
        selectReplacementRole: "اختر دور اللاعب البديل",
    },
};

// ─── دوال مساعدة ──────────────────────────────────────────────────────────────

export function t(path: string): string {
    const value = path.split(".").reduce<any>((acc, key) => acc?.[key], ar);
    return typeof value === "string" ? value : path;
}

export function getPhaseLabel(phase: string): string {
    return ar.phases[phase as keyof typeof ar.phases] || phase;
}

export function applyArabicDocumentLayout(): void {
    document.documentElement.lang = "ar";
    document.documentElement.dir  = "rtl";
    document.body.dir              = "rtl";
    document.body.style.direction  = "rtl";
    document.body.style.textAlign  = "right";
    document.documentElement.style.setProperty("--ss-font-ar", ARABIC_FONT_FAMILY);

    if (!document.getElementById("ss-arabic-layout")) {
        const style = document.createElement("style");
        style.id = "ss-arabic-layout";
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&family=Cairo:wght@400;600;700&display=swap');

            *, *::before, *::after {
                box-sizing: border-box;
            }

            html, body {
                direction: rtl;
                text-align: right;
                unicode-bidi: plaintext;
                font-family: 'Tajawal', 'Cairo', 'Arial', sans-serif;
                background: #0a0d13;
                overflow: hidden;
            }

            /* ─── منع الـ Phaser Canvas من كسر العربية ─── */
            canvas {
                direction: ltr !important; /* Canvas دائماً LTR داخلياً */
            }

            /* ─── HTML overlays فوق الـ Canvas — RTL ─── */
            .arab-overlay {
                direction: rtl;
                text-align: right;
                font-family: 'Tajawal', 'Cairo', 'Arial', sans-serif;
                unicode-bidi: plaintext;
            }

            /* ─── inputs عربية ─── */
            input, textarea, button {
                font-family: 'Tajawal', 'Cairo', 'Arial', sans-serif;
            }

            /* ─── iOS Safari fixes ─── */
            input, textarea {
                -webkit-appearance: none;
                border-radius: 0;
            }

            /* ─── منع التحديد العشوائي ─── */
            .no-select {
                -webkit-user-select: none;
                user-select: none;
            }

            /* ─── Animations ─── */
            @keyframes eventSlideIn {
                from { opacity: 0; transform: translateX(8px); }
                to   { opacity: 1; transform: translateX(0);   }
            }
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(12px); }
                to   { opacity: 1; transform: translateY(0);    }
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to   { opacity: 1; }
            }
            @keyframes slideInRight {
                from { transform: translateX(20px); opacity: 0; }
                to   { transform: translateX(0);    opacity: 1; }
            }
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50%       { opacity: 0.5; }
            }
        `;
        document.head.appendChild(style);
    }
}