export const ARABIC_FONT_FAMILY = "Tajawal";
export const UI_FONT_FAMILY = ARABIC_FONT_FAMILY;

export const ar = {
    appTitle: "المنظمة السرية",
    phases: {
        WAITING: "بانتظار البدء",
        LOBBY: "الردهة",
        DAY: "النهار",
        NIGHT: "الليل",
        VOTING: "التصويت",
        NIGHT_REVIEW: "مراجعة الليل",
        GAME_OVER: "انتهت اللعبة",
    },
    lobby: {
        reconnecting: "جارٍ إعادة الاتصال...",
        welcomeBack: (username: string) => `مرحباً بعودتك يا ${username}`,
        startingNewSession: "جارٍ بدء جلسة جديدة...",
        connectionTimeout: "انتهت مهلة الاتصال",
        cannotConnect: "تعذر الاتصال بالخادم",
        enterSociety: "الدخول إلى المنظمة السرية",
        joinQueue: "انضم الآن",
        connecting: "جارٍ الاتصال...",
        searching: "جارٍ البحث...",
        joining: "جارٍ الانضمام...",
        waitingForPlayers: "بانتظار بقية اللاعبين...",
        connected: "تم الاتصال بالخادم",
        adminReady: "لوحة الأدمن جاهزة",
        adminJoining: "جارٍ الدخول كأدمن...",
        spectatorJoining: "جارٍ البحث عن لعبة نشطة...",
        playerJoining: "جارٍ الانضمام إلى الطابور...",
        usernameMin: "الاسم يجب أن يكون حرفين على الأقل",
        playerPasswordRequired: "اختر لاعب ثم أدخل كلمة السر أولاً",
        queueCount: (size: number, required: number) => `• في الطابور: ${size} / ${required}`,
        passwordSet: (password: string) => `تم حفظ كلمة السر: ${password}`,
        noPassword: "لا توجد كلمة سر للجلسة",
        serverReset: "تمت إعادة ضبط الخادم من الأدمن",
        sessionReset: "تم تغيير كلمة السر، أدخل الكلمة الجديدة للمتابعة",
        usernameLabel: "اسم المستخدم",
        joinAsLabel: "طريقة الدخول",
        cardTag: "المنظمة السرية",
        subtitle: "لعبة جماعية في الخداع والاستنتاج",
        tagline: "اخدع. استنتج. وابقَ حياً.",
        featureHiddenRoles: "أدوار مخفية",
        featureStrategicVoting: "تصويت استراتيجي",
        featureNightElimination: "إقصاء ليلي",
        rolePlayer: "لاعب",
        roleSpectator: "مشاهد",
        roleAdmin: "أدمن",
        roleUnlocked: "تم فتح اللعب، اختر لاعب",
        resetServerButton: "إعادة ضبط الخادم",
        resetServerConfirm: "سيتم طرد جميع اللاعبين ومسح الجلسة بالكامل. هل أنت متأكد؟",
    },
    roles: {
        ADMIN: "الأدمن",
        MAFIA: "المافيا",
        DOCTOR: "الطبيب",
        DETECTIVE: "المحقق",
        CITIZEN: "المواطن",
        SPECTATOR: "المشاهد",
    },
    night: {
        room: (roomId: string) => `الغرفة ${roomId}`,
        nightPhase: "مرحلة الليل",
        mafiaRoleLabel: "المافيا",
        doctorRoleLabel: "الطبيب",
        detectiveRoleLabel: "المحقق",
        mafiaTitle: "اختر هدفك",
        mafiaDeadTitle: "لقد خرجت من اللعبة",
        mafiaSubtitle: "نسّق مع فريقك ثم ثبّت الهدف",
        mafiaDeadSubtitle: "راقب تخطيط المافيا من بعيد",
        mafiaSuggested: "تم اقتراح الهدف",
        mafiaSuggest: "اقترح",
        mafiaChannel: "قناة المافيا",
        mafiaSystemSuggested: (from: string, target: string) => `${from} اقترح استهداف ${target}`,
        doctorTitle: "من تريد حمايته؟",
        doctorSubtitle: "احمِ لاعباً واحداً من هجوم المافيا الليلة",
        doctorProtect: "احمِه",
        doctorSaving: "جارٍ الحماية",
        doctorProtected: "تمت الحماية",
        doctorProtecting: (username: string) => `أنت تحمي ${username}`,
        detectiveTitle: "حقّق مع مشتبه به",
        detectiveSubtitle: "اكشف هوية لاعب واحد هذه الليلة",
        detectiveInspect: "حقّق",
        detectiveScanning: "جارٍ التحقيق",
        detectiveInvestigating: (username: string) => `جارٍ التحقيق مع ${username}`,
        noTargets: "لا يوجد أهداف متاحة",
        noPlayers: "لا يوجد لاعبون متاحون",
        noSuspects: "لا يوجد مشتبه بهم حالياً",
        you: "أنت",
        eliminatedNight: (username: string) => `تم قتل ${username} أثناء الليل`,
        failedSave: (username: string) => `فشلت الحماية، قُتل ${username}`,
    },
    game: {
        players: "اللاعبون",
        stats: "الإحصاءات",
        timeline: "التسلسل",
        events: "الأحداث",
        chat: "الدردشة",
        live: "مباشر",
        room: (roomId: string) => `الغرفة ${roomId}`,
        round: (round: number) => `الجولة ${round}`,
        voteTie: "تعادل في التصويت، لم يُقصَ أحد",
        voteEliminated: (username: string) => `تم إقصاء ${username} بالتصويت`,
        newGameStarting: "تبدأ لعبة جديدة...",
        nightStory: (story: string) => `القصة: ${story}`,
        doctorSelectionError: "اختيار الطبيب غير صالح",
        mafiaSelectionError: "اختيار المافيا غير صالح",
        voiceMicDenied: "تم رفض إذن الميكروفون",
        voiceFailed: "تعذر تشغيل الصوت",
        voiceClickToUnmute: "اضغط لإلغاء الكتم",
        voiceClickToMute: "اضغط لكتم الميكروفون",
        winner: "الفائز",
        roundsPlayed: "الجولات",
        gameDuration: "مدة اللعبة",
        nightKills: "قتلى الليل",
        doctorSaves: "إنقاذات الطبيب",
        votedOut: "المقصيون بالتصويت",
        voteTies: "تعادلات التصويت",
        noEventsRecorded: "لا توجد أحداث مسجلة",
        waitingForAdmin: "بانتظار الأدمن لبدء لعبة جديدة...",
        adminPanel: "لوحة الأدمن",
        close: "إغلاق",
        rejoin: "إعادة الانضمام",
        rejoinCode: "رمز إعادة الانضمام",
        selectReplacementRole: "اختر دور اللاعب البديل ثم ولّد الرمز",
        generateCode: "توليد الرمز",
        generating: "جارٍ التوليد...",
        newCode: "رمز جديد",
        validFor15Minutes: "صالح لمدة 15 دقيقة",
        phaseControls: "التحكم بالمراحل",
        startNight: "ابدأ الليل",
        endNight: "إنهاء الليل",
        startVoting: "ابدأ التصويت",
        stopVoting: "إيقاف التصويت",
        forceEnd: "إنهاء فوري",
        restart: "إعادة التشغيل",
        nightActions: "إجراءات الليل",
        waiting: "بانتظار التنفيذ",
        completedBy: (username: string) => `تم بواسطة ${username}`,
        nightResults: "نتائج الليل",
        tonightStory: "قصة الليلة",
        writeTonightStory: "اكتب ما حدث هذه الليلة...",
        revealStory: "اعرض القصة للجميع",
        mafiaTarget: "هدف المافيا",
        doctorSaved: "إنقاذ الطبيب",
        finalVictim: "الضحية النهائية",
        protected: "تمت الحماية",
        noValue: "—",
        roleResultWinnerMafia: "المافيا",
        roleResultWinnerCitizens: "المواطنون",
        roundLabel: (round: number) => `الجولة ${round}`,
    },
};

export function t(path: string) {
    const value = path.split(".").reduce<any>((acc, key) => acc?.[key], ar);
    return typeof value === "string" ? value : path;
}

export function getPhaseLabel(phase: string) {
    return ar.phases[phase as keyof typeof ar.phases] || phase;
}

export function applyArabicDocumentLayout() {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    document.body.dir = "rtl";
    document.body.style.direction = "rtl";
    document.body.style.textAlign = "right";
    document.documentElement.style.setProperty("--ss-font-ar", ARABIC_FONT_FAMILY);

    if (!document.getElementById("ss-arabic-layout")) {
        const style = document.createElement("style");
        style.id = "ss-arabic-layout";
        style.textContent = `
            html, body, button, input, textarea, select {
                font-family: var(--ss-font-ar), Cairo, 'Segoe UI', Tahoma, sans-serif;
            }
            body {
                direction: rtl;
                text-align: right;
                unicode-bidi: plaintext;
            }
        `;
        document.head.appendChild(style);
    }
}
