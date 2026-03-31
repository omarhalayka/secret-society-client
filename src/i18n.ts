export const ARABIC_FONT_FAMILY = "'Tajawal', 'Arial', sans-serif";
export const ar = {
  appTitle: "المنظمة السرية",

  game: {
    usernamePlaceholder: "اكتب اسمك...",
  },

  lobby: {
    // ===== General =====
    reconnecting: "جارٍ إعادة الاتصال...",
    welcomeBack: (name: string) => `أهلاً بعودتك ${name}`,
    startingNewSession: "بدء جلسة جديدة...",
    connectionTimeout: "انتهت مهلة الاتصال",
    sessionExpired: "انتهت الجلسة",
    cannotConnect: "تعذر الاتصال بالسيرفر",

    // ===== Splash =====
    enterSociety: "دخول المنظمة",

    // ===== Labels =====
    cardTag: "LOBBY",
    usernameLabel: "اسم المستخدم",
    joinAsLabel: "الدخول كـ",

    // ===== Roles =====
    rolePlayer: "لاعب",
    roleSpectator: "مشاهد",
    roleAdmin: "أدمن",
    roleUnlocked: "تم فتح دور اللاعب",

    // ===== Buttons =====
    joinQueue: "دخول الطابور",
    connecting: "جارٍ الاتصال...",
    searching: "جارٍ البحث...",
    joining: "جارٍ الانضمام...",

    cancel: "إلغاء",
    confirm: "تأكيد",

    // ===== Queue =====
    queueCount: (current: number, required: number) =>
      `اللاعبين: ${current} / ${required}`,

    waitingForPlayers: "بانتظار باقي اللاعبين...",
    waitingForPlayersText: "بانتظار اللاعبين...",

    // ===== Status =====
    connected: "تم الاتصال",
    serverReset: "تم إعادة تشغيل السيرفر",
    sessionReset: "تم إعادة ضبط الجلسة",

    // ===== Admin =====
    adminAccess: "دخول الأدمن",
    enterAdminPassword: "أدخل كلمة مرور الأدمن",
    adminAccessGranted: "تم منح صلاحية الأدمن",
    incorrectPassword: "كلمة المرور غير صحيحة",
    resetServerButton: "إعادة تشغيل السيرفر",
    resetServerConfirm: "هل أنت متأكد؟",

    // ===== Session Settings =====
    sessionSettings: "إعدادات الجلسة",
    setPasswordAndPlayers: "حدد كلمة المرور وعدد اللاعبين",
    password: "كلمة المرور",
    passwordExample: "مثال: 1234",
    numberOfPlayers: "عدد اللاعبين",
    players: "لاعب",

    playerCountDesc4: "4 لاعبين (بسيط)",
    playerCountDesc5: "5 لاعبين",
    playerCountDesc6: "6 لاعبين (متوازن)",
    playerCountDesc7: "7 لاعبين",
    playerCountDesc8: "8 لاعبين",
    playerCountDesc9: "9 لاعبين",
    playerCountDesc10: "10 لاعبين",

    pleaseEnterPassword: "أدخل كلمة المرور",
    pleaseEnterUsername: "أدخل اسم المستخدم",
    pleaseEnterCode: "أدخل الكود",

    passwordSet: (pass: string) => `تم تعيين كلمة المرور: ${pass}`,
    noPassword: "بدون كلمة مرور",
    passwordSetText: "تم تعيين كلمة المرور",
    noPasswordText: "بدون كلمة مرور",

    // ===== Player Join =====
    joinAsPlayer: "الدخول كلاعب",
    passwordTab: "كلمة المرور",
    rejoinCodeTab: "كود الرجوع",
    sessionPasswordPlaceholder: "أدخل كلمة المرور",
    sessionPassword: "كلمة مرور الجلسة",
    enterSessionPassword: "أدخل كلمة المرور للانضمام",
    passwordCorrect: "كلمة المرور صحيحة",

    rejoinInstructions: "أدخل اسمك والكود للرجوع",
    yourUsername: "اسمك",
    codePlaceholder: "الكود",
    invalidCode: "الكود غير صحيح",

    // ===== Messages =====
    usernameMin: "الاسم قصير جدًا",
    adminJoining: "جارٍ دخول الأدمن...",
    spectatorJoining: "جارٍ دخول المشاهد...",
    playerJoining: "جارٍ دخول اللاعب...",
    selectPlayerFirst: "اختر لاعب أولاً",

    adminPanelReady: "لوحة الأدمن جاهزة",

    passwordPlaceholder: "كلمة المرور",

    mobileSubtitle: "ادخل وابدأ اللعب",
    subtitle: "SECRET SOCIETY",
    tagline: "لعبة خداع واستراتيجية",

    featureHiddenRoles: "أدوار مخفية",
    featureStrategicVoting: "تصويت استراتيجي",
    featureNightElimination: "إقصاء ليلي",
  },
};