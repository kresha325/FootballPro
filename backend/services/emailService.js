const nodemailer = require('nodemailer');
const { isEmailConfigured, isResendConfigured, buildParentConfirmUrl } = require('../config/email');

let transporter = null;

function getTransporter() {
  if (!isEmailConfigured()) {
    return null;
  }
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 0);
    if (process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: port || 587,
        secure: port === 465,
        // Some hosts (including container platforms) expose only an internal
        // IPv4 interface. Let Nodemailer still resolve the SMTP host's IPv4
        // address instead of selecting an unreachable IPv6 address.
        allowInternalNetworkInterfaces: true,
        auth: {
          user: process.env.SMTP_USER || process.env.EMAIL_USER,
          pass: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD,
        },
      });
    } else {
      transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        allowInternalNetworkInterfaces: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });
    }
  }
  return transporter;
}

const emailCopy = {
  sq: {
    resetSubject: '🔐 Rivendos fjalëkalimin e X TALENTI', resetTitle: 'Rivendos fjalëkalimin', hi: 'Përshëndetje',
    resetBody: 'Kemi marrë një kërkesë për rivendosjen e fjalëkalimit të X TALENTI. Shtyp butonin për të zgjedhur një fjalëkalim të ri. Ky link skadon pas një ore.',
    resetButton: 'Rivendos fjalëkalimin', ignore: 'Nëse nuk e ke kërkuar këtë, mund ta shpërfillësh këtë email.',
    welcomeSubject: '🏆 Mirë se vjen në X TALENTI!', welcomeTitle: 'Mirë se vjen në X TALENTI',
    welcomeBody: 'Faleminderit që iu bashkove komunitetit tonë ndërkombëtar të futbollit.', welcomeNext: 'Plotëso profilin dhe lidhu me lojtarë, skautë e klube në mbarë botën.', welcomeButton: 'Fillo tani',
    parentSubject: 'X TALENTI — konfirmim prindi', parentTitle: 'Konfirmim prindi ose kujdestari', parentBody: 'Për të aktivizuar llogarinë e një të mituri nën 18 vjeç, nevojitet miratimi yt si prind ose kujdestar ligjor.', parentAction: 'Konfirmo si prind', parentFallback: 'Nëse butoni nuk funksionon, hape këtë link në shfletues:', parentIgnore: 'Nëse nuk e prisje këtë email, mund ta shpërfillësh.',
  },
  en: {
    resetSubject: '🔐 Reset your X TALENTI password', resetTitle: 'Password reset', hi: 'Hi',
    resetBody: 'We received a request to reset your X TALENTI password. Click the button below to choose a new password. This link expires in one hour.',
    resetButton: 'Reset password', ignore: 'If you did not request this, you can ignore this email.',
    welcomeSubject: '🏆 Welcome to X TALENTI!', welcomeTitle: 'Welcome to X TALENTI',
    welcomeBody: 'Thank you for joining our global football community.', welcomeNext: 'Build your profile and connect with players, scouts, and clubs worldwide.', welcomeButton: 'Get started',
    parentSubject: 'X TALENTI — parental approval', parentTitle: 'Parent or guardian approval', parentBody: 'An adult’s approval is required to activate an account for someone under 18.', parentAction: 'Confirm as parent', parentFallback: 'If the button does not work, open this link in your browser:', parentIgnore: 'If you were not expecting this email, you can ignore it.',
  },
  de: {
    resetSubject: '🔐 X TALENTI Passwort zurücksetzen', resetTitle: 'Passwort zurücksetzen', hi: 'Hallo', resetBody: 'Wir haben eine Anfrage zum Zurücksetzen deines X TALENTI Passworts erhalten. Wähle über die Schaltfläche ein neues Passwort. Dieser Link ist eine Stunde gültig.', resetButton: 'Passwort zurücksetzen', ignore: 'Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.',
    welcomeSubject: '🏆 Willkommen bei X TALENTI!', welcomeTitle: 'Willkommen bei X TALENTI', welcomeBody: 'Danke, dass du unserer internationalen Fußballgemeinschaft beigetreten bist.', welcomeNext: 'Erstelle dein Profil und vernetze dich weltweit mit Spielern, Scouts und Vereinen.', welcomeButton: 'Jetzt starten',
    parentSubject: 'X TALENTI — Zustimmung der Eltern', parentTitle: 'Zustimmung der Eltern oder Erziehungsberechtigten', parentBody: 'Für ein Konto einer Person unter 18 Jahren ist die Zustimmung der Eltern oder Erziehungsberechtigten erforderlich.', parentAction: 'Als Elternteil bestätigen', parentFallback: 'Falls die Schaltfläche nicht funktioniert, öffne diesen Link im Browser:', parentIgnore: 'Falls du diese E-Mail nicht erwartet hast, kannst du sie ignorieren.',
  },
  fr: {
    resetSubject: '🔐 Réinitialisez votre mot de passe X TALENTI', resetTitle: 'Réinitialisation du mot de passe', hi: 'Bonjour', resetBody: 'Nous avons reçu une demande de réinitialisation de votre mot de passe X TALENTI. Cliquez ci-dessous pour en choisir un nouveau. Ce lien expire dans une heure.', resetButton: 'Réinitialiser le mot de passe', ignore: 'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.',
    welcomeSubject: '🏆 Bienvenue sur X TALENTI !', welcomeTitle: 'Bienvenue sur X TALENTI', welcomeBody: 'Merci d’avoir rejoint notre communauté mondiale de football.', welcomeNext: 'Créez votre profil et échangez avec des joueurs, recruteurs et clubs du monde entier.', welcomeButton: 'Commencer',
    parentSubject: 'X TALENTI — accord parental', parentTitle: 'Accord du parent ou tuteur', parentBody: 'L’accord d’un parent ou tuteur est nécessaire pour activer le compte d’une personne de moins de 18 ans.', parentAction: 'Confirmer en tant que parent', parentFallback: 'Si le bouton ne fonctionne pas, ouvrez ce lien dans votre navigateur :', parentIgnore: 'Si vous n’attendiez pas cet e-mail, vous pouvez l’ignorer.',
  },
  it: {
    resetSubject: '🔐 Reimposta la password X TALENTI', resetTitle: 'Reimpostazione password', hi: 'Ciao', resetBody: 'Abbiamo ricevuto una richiesta per reimpostare la password X TALENTI. Premi il pulsante per sceglierne una nuova. Il link scade tra un’ora.', resetButton: 'Reimposta password', ignore: 'Se non hai richiesto questa operazione, puoi ignorare questa email.',
    welcomeSubject: '🏆 Benvenuto su X TALENTI!', welcomeTitle: 'Benvenuto su X TALENTI', welcomeBody: 'Grazie per esserti unito alla nostra comunità calcistica globale.', welcomeNext: 'Crea il tuo profilo e connettiti con giocatori, scout e club di tutto il mondo.', welcomeButton: 'Inizia ora',
    parentSubject: 'X TALENTI — autorizzazione genitoriale', parentTitle: 'Autorizzazione del genitore o tutore', parentBody: 'Per attivare l’account di una persona minore di 18 anni è necessaria l’autorizzazione di un genitore o tutore legale.', parentAction: 'Conferma come genitore', parentFallback: 'Se il pulsante non funziona, apri questo link nel browser:', parentIgnore: 'Se non aspettavi questa email, puoi ignorarla.',
  },
  es: {
    resetSubject: '🔐 Restablece tu contraseña de X TALENTI', resetTitle: 'Restablecer contraseña', hi: 'Hola', resetBody: 'Hemos recibido una solicitud para restablecer tu contraseña de X TALENTI. Pulsa el botón para elegir una nueva. El enlace caduca en una hora.', resetButton: 'Restablecer contraseña', ignore: 'Si no solicitaste esto, puedes ignorar este correo.',
    welcomeSubject: '🏆 ¡Te damos la bienvenida a X TALENTI!', welcomeTitle: 'Te damos la bienvenida a X TALENTI', welcomeBody: 'Gracias por unirte a nuestra comunidad futbolística global.', welcomeNext: 'Crea tu perfil y conecta con jugadores, ojeadores y clubes de todo el mundo.', welcomeButton: 'Empezar',
    parentSubject: 'X TALENTI — autorización parental', parentTitle: 'Autorización del padre, madre o tutor', parentBody: 'Se necesita la autorización de un padre, madre o tutor legal para activar la cuenta de una persona menor de 18 años.', parentAction: 'Confirmar como tutor', parentFallback: 'Si el botón no funciona, abre este enlace en tu navegador:', parentIgnore: 'Si no esperabas este correo, puedes ignorarlo.',
  },
  ro: {
    resetSubject: '🔐 Resetează parola X TALENTI', resetTitle: 'Resetarea parolei', hi: 'Salut', resetBody: 'Am primit o solicitare de resetare a parolei X TALENTI. Apasă butonul pentru a alege o parolă nouă. Linkul expiră într-o oră.', resetButton: 'Resetează parola', ignore: 'Dacă nu ai solicitat acest lucru, poți ignora acest e-mail.',
    welcomeSubject: '🏆 Bun venit la X TALENTI!', welcomeTitle: 'Bun venit la X TALENTI', welcomeBody: 'Îți mulțumim că te-ai alăturat comunității noastre globale de fotbal.', welcomeNext: 'Creează-ți profilul și conectează-te cu jucători, scouteri și cluburi din întreaga lume.', welcomeButton: 'Începe acum',
    parentSubject: 'X TALENTI — acord parental', parentTitle: 'Acordul părintelui sau tutorelui', parentBody: 'Este necesar acordul unui părinte sau tutore legal pentru activarea contului unei persoane sub 18 ani.', parentAction: 'Confirmă ca părinte', parentFallback: 'Dacă butonul nu funcționează, deschide acest link în browser:', parentIgnore: 'Dacă nu așteptai acest e-mail, îl poți ignora.',
  },
  hr: {
    resetSubject: '🔐 Ponovno postavi lozinku za X TALENTI', resetTitle: 'Ponovno postavljanje lozinke', hi: 'Pozdrav', resetBody: 'Primili smo zahtjev za ponovno postavljanje lozinke za X TALENTI. Pritisni gumb i odaberi novu lozinku. Poveznica vrijedi jedan sat.', resetButton: 'Ponovno postavi lozinku', ignore: 'Ako nisi zatražio/la ovu promjenu, možeš zanemariti ovu e-poštu.',
    welcomeSubject: '🏆 Dobro došao/la na X TALENTI!', welcomeTitle: 'Dobro došao/la na X TALENTI', welcomeBody: 'Hvala ti što si se pridružio/la našoj globalnoj nogometnoj zajednici.', welcomeNext: 'Izradi profil i poveži se s igračima, skautima i klubovima diljem svijeta.', welcomeButton: 'Započni',
    parentSubject: 'X TALENTI — roditeljska suglasnost', parentTitle: 'Suglasnost roditelja ili skrbnika', parentBody: 'Za aktivaciju računa osobe mlađe od 18 godina potrebna je suglasnost roditelja ili zakonskog skrbnika.', parentAction: 'Potvrdi kao roditelj', parentFallback: 'Ako gumb ne radi, otvori ovu poveznicu u pregledniku:', parentIgnore: 'Ako nisi očekivao/la ovu e-poštu, možeš je zanemariti.',
  },
  tr: {
    resetSubject: '🔐 X TALENTI şifreni sıfırla', resetTitle: 'Şifre sıfırlama', hi: 'Merhaba', resetBody: 'X TALENTI şifreni sıfırlamak için bir istek aldık. Yeni şifre belirlemek için aşağıdaki düğmeye tıkla. Bu bağlantı bir saat içinde sona erer.', resetButton: 'Şifreyi sıfırla', ignore: 'Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.',
    welcomeSubject: '🏆 X TALENTI’ye hoş geldin!', welcomeTitle: 'X TALENTI’ye hoş geldin', welcomeBody: 'Küresel futbol topluluğumuza katıldığın için teşekkür ederiz.', welcomeNext: 'Profilini oluştur ve dünyanın dört bir yanındaki oyuncular, scoutlar ve kulüplerle bağlantı kur.', welcomeButton: 'Başla',
    parentSubject: 'X TALENTI — ebeveyn onayı', parentTitle: 'Ebeveyn veya vasi onayı', parentBody: '18 yaşından küçük bir kişinin hesabını etkinleştirmek için ebeveyn veya yasal vasinin onayı gerekir.', parentAction: 'Ebeveyn olarak onayla', parentFallback: 'Düğme çalışmazsa bu bağlantıyı tarayıcında aç:', parentIgnore: 'Bu e-postayı beklemiyorsan yok sayabilirsin.',
  },
};

function copyFor(language) {
  return emailCopy[String(language || 'sq').toLowerCase()] || emailCopy.sq;
}

const notificationEmailCopy = {
  sq: { newMessage: 'Mesazh i ri nga', reply: 'Përgjigju tani', notice: 'Njoftim', open: 'Hape në X TALENTI' },
  en: { newMessage: 'New message from', reply: 'Reply now', notice: 'Notice', open: 'Open X TALENTI' },
  de: { newMessage: 'Neue Nachricht von', reply: 'Jetzt antworten', notice: 'Mitteilung', open: 'X TALENTI öffnen' },
  fr: { newMessage: 'Nouveau message de', reply: 'Répondre maintenant', notice: 'Information', open: 'Ouvrir X TALENTI' },
  it: { newMessage: 'Nuovo messaggio da', reply: 'Rispondi ora', notice: 'Avviso', open: 'Apri X TALENTI' },
  es: { newMessage: 'Nuevo mensaje de', reply: 'Responder ahora', notice: 'Aviso', open: 'Abrir X TALENTI' },
  ro: { newMessage: 'Mesaj nou de la', reply: 'Răspunde acum', notice: 'Notificare', open: 'Deschide X TALENTI' },
  hr: { newMessage: 'Nova poruka od', reply: 'Odgovori odmah', notice: 'Obavijest', open: 'Otvori X TALENTI' },
  tr: { newMessage: 'Yeni mesaj gönderen', reply: 'Şimdi yanıtla', notice: 'Bildirim', open: 'X TALENTI’yi aç' },
};

function notificationCopy(language) {
  return notificationEmailCopy[String(language || 'sq').toLowerCase()] || notificationEmailCopy.sq;
}

const rosterEmailCopy = {
  sq: { request: 'Kërkesë e re për skuadrën', wants: 'dëshiron t’i bashkohet skuadrës si', review: 'Shqyrto kërkesën', approved: 'Kërkesa u aprovua', congrats: 'Urime!', joined: 'e ka aprovuar kërkesën tënde për t’iu bashkuar skuadrës si', details: 'Shiko hollësitë', rejected: 'Përditësim i kërkesës për skuadrën', reviewed: 'e ka shqyrtuar kërkesën tënde për skuadrën si', encourage: 'Vazhdo të zhvillohesh dhe provo përsëri më vonë.', other: 'Gjej klube të tjera', message: 'Mesazhi' },
  en: { request: 'New roster request', wants: 'wants to join your roster as', review: 'Review request', approved: 'Roster request approved', congrats: 'Congratulations!', joined: 'approved your request to join the roster as', details: 'View details', rejected: 'Roster request update', reviewed: 'reviewed your roster request for', encourage: 'Keep developing and try again later.', other: 'Find other clubs', message: 'Message' },
  de: { request: 'Neue Kaderanfrage', wants: 'möchte dem Kader beitreten als', review: 'Anfrage prüfen', approved: 'Kaderanfrage genehmigt', congrats: 'Glückwunsch!', joined: 'hat deine Anfrage zum Beitritt als genehmigt', details: 'Details ansehen', rejected: 'Aktualisierung der Kaderanfrage', reviewed: 'hat deine Kaderanfrage geprüft für', encourage: 'Entwickle dich weiter und versuche es später erneut.', other: 'Andere Vereine finden', message: 'Nachricht' },
  fr: { request: 'Nouvelle demande pour l’effectif', wants: 'souhaite rejoindre votre effectif comme', review: 'Examiner la demande', approved: 'Demande approuvée', congrats: 'Félicitations !', joined: 'a approuvé votre demande pour rejoindre l’effectif comme', details: 'Voir les détails', rejected: 'Mise à jour de la demande', reviewed: 'a examiné votre demande pour le poste', encourage: 'Continuez à progresser et réessayez plus tard.', other: 'Trouver d’autres clubs', message: 'Message' },
  it: { request: 'Nuova richiesta per la rosa', wants: 'vuole unirsi alla rosa come', review: 'Esamina la richiesta', approved: 'Richiesta approvata', congrats: 'Congratulazioni!', joined: 'ha approvato la tua richiesta di entrare in rosa come', details: 'Vedi dettagli', rejected: 'Aggiornamento della richiesta', reviewed: 'ha esaminato la tua richiesta per il ruolo', encourage: 'Continua a migliorare e riprova più avanti.', other: 'Trova altri club', message: 'Messaggio' },
  es: { request: 'Nueva solicitud para la plantilla', wants: 'quiere unirse a tu plantilla como', review: 'Revisar solicitud', approved: 'Solicitud aprobada', congrats: '¡Enhorabuena!', joined: 'ha aprobado tu solicitud para unirte a la plantilla como', details: 'Ver detalles', rejected: 'Actualización de la solicitud', reviewed: 'ha revisado tu solicitud para el puesto', encourage: 'Sigue mejorando e inténtalo de nuevo más adelante.', other: 'Encontrar otros clubes', message: 'Mensaje' },
  ro: { request: 'Cerere nouă pentru lot', wants: 'dorește să se alăture lotului ca', review: 'Examinează cererea', approved: 'Cerere aprobată', congrats: 'Felicitări!', joined: 'ți-a aprobat cererea de a intra în lot ca', details: 'Vezi detaliile', rejected: 'Actualizare a cererii', reviewed: 'ți-a examinat cererea pentru rolul', encourage: 'Continuă să evoluezi și încearcă din nou mai târziu.', other: 'Găsește alte cluburi', message: 'Mesaj' },
  hr: { request: 'Novi zahtjev za sastav', wants: 'želi se pridružiti sastavu kao', review: 'Pregledaj zahtjev', approved: 'Zahtjev odobren', congrats: 'Čestitamo!', joined: 'odobrio je tvoj zahtjev za pridruživanje sastavu kao', details: 'Pogledaj pojedinosti', rejected: 'Ažuriranje zahtjeva', reviewed: 'pregledao je tvoj zahtjev za poziciju', encourage: 'Nastavi napredovati i pokušaj ponovno kasnije.', other: 'Pronađi druge klubove', message: 'Poruka' },
  tr: { request: 'Yeni kadro başvurusu', wants: 'kadroya şu pozisyonda katılmak istiyor:', review: 'Başvuruyu incele', approved: 'Kadro başvurusu onaylandı', congrats: 'Tebrikler!', joined: 'kadroya şu pozisyonda katılma başvurunu onayladı:', details: 'Detayları görüntüle', rejected: 'Kadro başvurusu güncellemesi', reviewed: 'kadro başvurunu şu pozisyon için inceledi:', encourage: 'Gelişmeye devam et ve daha sonra tekrar dene.', other: 'Diğer kulüpleri bul', message: 'Mesaj' },
};

function rosterCopy(language) {
  return rosterEmailCopy[String(language || 'sq').toLowerCase()] || rosterEmailCopy.sq;
}

// Email templates
const emailTemplates = {
  passwordReset: (firstName, resetUrl, language = 'sq') => {
    const c = copyFor(language);
    return {
    subject: c.resetSubject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">${c.resetTitle}</h1>
        <p>${c.hi} ${firstName || ''},</p>
        <p>${c.resetBody}</p>
        <a href="${resetUrl}"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          ${c.resetButton}
        </a>
        <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">${c.ignore}</p>
      </div>
    `
    };
  },

  welcome: (firstName, language = 'sq') => {
    const c = copyFor(language);
    return {
    subject: c.welcomeSubject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">${c.welcomeTitle}, ${firstName || ''}!</h1>
        <p>${c.welcomeBody}</p>
        <p>${c.welcomeNext}</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          ${c.welcomeButton}
        </a>
      </div>
    `
    };
  },

  newFollower: (followerName, userId) => ({
    subject: `🔔 ${followerName} started following you!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${followerName} is now following you on X TALENTI</h2>
        <p>Check out their profile and connect!</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/profile/${userId}"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          View Profile
        </a>
      </div>
    `
  }),

  newLike: (likerName, postId) => ({
    subject: `👍 ${likerName} liked your post`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${likerName} liked your post</h2>
        <p>Your content is getting noticed!</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/feed?post=${postId}"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          View Post
        </a>
      </div>
    `
  }),

  newComment: (commenterName, comment, postId) => ({
    subject: `💬 ${commenterName} commented on your post`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${commenterName} commented:</h2>
        <p style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 20px 0;">"${comment}"</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/feed?post=${postId}"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          View Comment
        </a>
      </div>
    `
  }),

  newMessage: (senderName, preview, conversationId, language = 'sq') => {
    const c = notificationCopy(language);
    return {
    subject: `📨 ${c.newMessage} ${senderName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${c.newMessage} ${senderName}</h2>
        <p style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 20px 0;">${preview}</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/messaging"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          ${c.reply}
        </a>
      </div>
    `
  }; },

  scoutingRecommendation: (scoutName, clubName) => ({
    subject: `🔍 ${scoutName} from ${clubName} is interested in you!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been scouted!</h2>
        <p><strong>${scoutName}</strong> from <strong>${clubName}</strong> has shown interest in your profile.</p>
        <p>This could be your big opportunity!</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/scouting"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          View Details
        </a>
      </div>
    `
  }),

  tournamentInvite: (tournamentName) => ({
    subject: `🏆 You're invited to ${tournamentName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Tournament Invitation</h2>
        <p>You've been invited to participate in <strong>${tournamentName}</strong></p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/tournaments"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          View Tournament
        </a>
      </div>
    `
  }),

  premiumExpiring: (firstName, daysLeft) => ({
    subject: `⏰ Your Premium expires in ${daysLeft} days`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Premium Subscription Expiring</h2>
        <p>Hi ${firstName},</p>
        <p>Your Premium subscription will expire in <strong>${daysLeft} days</strong>.</p>
        <p>Renew now to keep your premium features!</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/premium"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          Renew Premium
        </a>
      </div>
    `
  }),

  rosterRequest: (data) => {
    const c = rosterCopy(data.language);
    return {
    subject: `🏆 ${c.request} — ${data.athleteName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${c.request}</h2>
        <p>${copyFor(data.language).hi} ${data.clubName},</p>
        <p><strong>${data.athleteName}</strong> ${c.wants} <strong>${data.position}</strong>.</p>
        ${data.message ? `<p style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 20px 0;">${c.message}: "${data.message}"</p>` : ''}
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/roster/requests"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          ${c.review}
        </a>
      </div>
    `
  }; },

  rosterApproved: (data) => {
    const c = rosterCopy(data.language);
    return {
    subject: `🎉 ${c.approved} — ${data.clubName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${c.congrats}</h2>
        <p>${copyFor(data.language).hi} ${data.athleteName},</p>
        <p><strong>${data.clubName}</strong> ${c.joined} <strong>${data.position}</strong>!</p>
        ${data.message ? `<p style="background: #dcfce7; padding: 12px; border-radius: 6px; margin: 20px 0;">${data.message}</p>` : ''}
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/roster/my-requests"
           style="background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          ${c.details}
        </a>
      </div>
    `
  }; },
  parentVerification: (athleteName, token, language = 'sq') => {
    const confirmUrl = buildParentConfirmUrl(token);
    const c = copyFor(language);
    return {
      subject: `${c.parentSubject} — ${athleteName}`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
        <h2 style="color: #0f766e;">${c.parentTitle}</h2>
        <p>${c.hi},</p>
        <p>${c.parentBody}</p>
        <a href="${confirmUrl}"
           style="background: #0f766e; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: bold;">
          ${c.parentAction}
        </a>
        <p style="color:#6b7280; font-size:13px;">${c.parentFallback}</p>
        <p style="word-break: break-all; font-size:12px; color:#475569;">${confirmUrl}</p>
        <p style="margin-top:20px; color:#9ca3af; font-size:12px;">${c.parentIgnore}</p>
        <p style="color:#9ca3af; font-size:12px;">— <strong>X TALENTI</strong></p>
      </div>
    `,
    };
  },
  parentConsentManagement: (athleteName, managementUrl) => {
    const name = String(athleteName || 'atletit').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const url = String(managementUrl || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return {
      subject: 'X TALENTI — Menaxhimi i autorizimit prindëror',
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#111"><h2>Autorizimi prindëror u regjistrua</h2><p>Autorizimi për llogarinë sportive të <strong>${name}</strong> u regjistrua pas deklarimit tuaj.</p><p>Ruajeni këtë email. Nga kjo faqe mund ta tërhiqni autorizimin në çdo kohë.</p><a href="${url}" style="background:#0f766e;color:#fff;padding:14px 24px;text-decoration:none;border-radius:8px;display:inline-block">Menaxho ose tërhiq autorizimin</a><p style="color:#64748b;font-size:13px">Nëse nuk e keni bërë këtë kërkesë, kontaktoni mbështetjen e X TALENTI.</p></div>`,
    };
  },
  parentCommunicationConsent: (athleteName, adultName, clubName, channel, token, language = 'sq') => {
    const safe = (value) => String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const languageKey = String(language || 'sq').toLowerCase();
    const copy = {
      sq: { subject: 'X TALENTI — kërkesë për pëlqim komunikimi', title: 'Pëlqim i posaçëm për komunikim', intro: 'Kërkohet vendimi yt për komunikimin e të miturit me këtë person.', athlete: 'Atleti', adult: 'Personi', club: 'Klubi', scope: 'Lloji i komunikimit', button: 'Shqyrto kërkesën', note: 'Ky miratim nuk ndryshon pëlqimin e llogarisë ose dukshmërisë së profilit. Mund ta tërheqësh në çdo kohë.' },
      en: { subject: 'X TALENTI — communication consent request', title: 'Specific communication consent', intro: 'Your decision is needed for this adult to communicate with the minor.', athlete: 'Athlete', adult: 'Adult', club: 'Club', scope: 'Communication type', button: 'Review request', note: 'This approval does not change account or profile-visibility consent. You may withdraw it at any time.' },
      de: { subject: 'X TALENTI — Zustimmung zur Kommunikation', title: 'Gezielte Kommunikationsfreigabe', intro: 'Deine Entscheidung ist erforderlich, damit diese erwachsene Person mit dem Minderjährigen kommunizieren darf.', athlete: 'Athlet', adult: 'Erwachsene Person', club: 'Verein', scope: 'Kommunikationsart', button: 'Anfrage prüfen', note: 'Diese Zustimmung ändert weder die Konto- noch die Profilfreigabe. Du kannst sie jederzeit widerrufen.' },
      fr: { subject: 'X TALENTI — demande de consentement', title: 'Consentement spécifique à la communication', intro: 'Votre décision est nécessaire pour permettre à cet adulte de communiquer avec le mineur.', athlete: 'Athlète', adult: 'Adulte', club: 'Club', scope: 'Type de communication', button: 'Examiner la demande', note: 'Cette autorisation ne modifie pas le consentement du compte ou de visibilité du profil. Vous pouvez la retirer à tout moment.' },
      it: { subject: 'X TALENTI — richiesta di consenso', title: 'Consenso specifico alla comunicazione', intro: 'È necessaria la tua decisione per consentire a questo adulto di comunicare con il minore.', athlete: 'Atleta', adult: 'Adulto', club: 'Club', scope: 'Tipo di comunicazione', button: 'Esamina la richiesta', note: 'Questa autorizzazione non modifica il consenso dell’account o della visibilità del profilo. Puoi revocarla in qualsiasi momento.' },
      es: { subject: 'X TALENTI — solicitud de consentimiento', title: 'Consentimiento específico de comunicación', intro: 'Necesitamos tu decisión para que este adulto pueda comunicarse con el menor.', athlete: 'Atleta', adult: 'Adulto', club: 'Club', scope: 'Tipo de comunicación', button: 'Revisar solicitud', note: 'Esta autorización no cambia el consentimiento de la cuenta ni la visibilidad del perfil. Puedes retirarla cuando quieras.' },
      ro: { subject: 'X TALENTI — solicitare de consimțământ', title: 'Consimțământ specific pentru comunicare', intro: 'Este necesară decizia ta pentru ca acest adult să comunice cu minorul.', athlete: 'Sportiv', adult: 'Adult', club: 'Club', scope: 'Tipul comunicării', button: 'Examinează cererea', note: 'Această aprobare nu modifică acordul pentru cont sau vizibilitatea profilului. O poți retrage oricând.' },
      hr: { subject: 'X TALENTI — zahtjev za suglasnost', title: 'Posebna suglasnost za komunikaciju', intro: 'Potrebna je tvoja odluka kako bi ova odrasla osoba mogla komunicirati s maloljetnikom.', athlete: 'Sportaš', adult: 'Odrasla osoba', club: 'Klub', scope: 'Vrsta komunikacije', button: 'Pregledaj zahtjev', note: 'Ova suglasnost ne mijenja odobrenje računa ni vidljivost profila. Možeš je povući u bilo kojem trenutku.' },
      tr: { subject: 'X TALENTI — iletişim izni talebi', title: 'Belirli iletişim izni', intro: 'Bu yetişkinin reşit olmayan kişiyle iletişim kurabilmesi için kararın gerekiyor.', athlete: 'Sporcu', adult: 'Yetişkin', club: 'Kulüp', scope: 'İletişim türü', button: 'Talebi incele', note: 'Bu onay hesap veya profil görünürlüğü iznini değiştirmez. İstediğin zaman geri çekebilirsin.' },
    }[languageKey] || null;
    const c = copy || {
      subject: 'X TALENTI — communication consent request', title: 'Specific communication consent',
      intro: 'Your decision is needed for this adult to communicate with the minor.', athlete: 'Athlete', adult: 'Adult', club: 'Club', scope: 'Communication type', button: 'Review request',
      note: 'This approval does not change account or profile-visibility consent. You may withdraw it at any time.',
    };
    const confirmUrl = buildParentConfirmUrl(token);
    const channelNames = {
      sq: { direct_message: 'Mesazhe private', group_message: 'Mesazhe në grup', video_call: 'Telefonata me video', private_live_invitation: 'Ftesa private live', guardian_mediated_group: 'Grup komunikimi me kujdestarin' },
      en: { direct_message: 'Private messages', group_message: 'Group messages', video_call: 'Video calls', private_live_invitation: 'Private live invitations', guardian_mediated_group: 'Guardian-mediated group' },
      de: { direct_message: 'Private Nachrichten', group_message: 'Gruppennachrichten', video_call: 'Videoanrufe', private_live_invitation: 'Private Live-Einladungen', guardian_mediated_group: 'Gruppe mit erziehungsberechtigter Person' },
      fr: { direct_message: 'Messages privés', group_message: 'Messages de groupe', video_call: 'Appels vidéo', private_live_invitation: 'Invitations privées au direct', guardian_mediated_group: 'Groupe avec le tuteur' },
      it: { direct_message: 'Messaggi privati', group_message: 'Messaggi di gruppo', video_call: 'Videochiamate', private_live_invitation: 'Inviti privati alle dirette', guardian_mediated_group: 'Gruppo con il tutore' },
      es: { direct_message: 'Mensajes privados', group_message: 'Mensajes de grupo', video_call: 'Videollamadas', private_live_invitation: 'Invitaciones privadas al directo', guardian_mediated_group: 'Grupo con el tutor' },
      ro: { direct_message: 'Mesaje private', group_message: 'Mesaje de grup', video_call: 'Apeluri video', private_live_invitation: 'Invitații private la transmisiune', guardian_mediated_group: 'Grup cu tutorele' },
      hr: { direct_message: 'Privatne poruke', group_message: 'Grupne poruke', video_call: 'Videopozivi', private_live_invitation: 'Privatni pozivi u prijenos uživo', guardian_mediated_group: 'Grupa sa skrbnikom' },
      tr: { direct_message: 'Özel mesajlar', group_message: 'Grup mesajları', video_call: 'Görüntülü aramalar', private_live_invitation: 'Özel canlı yayın davetleri', guardian_mediated_group: 'Veliyle oluşturulan grup' },
    }[languageKey] || {};
    return {
      subject: `${c.subject} — ${safe(athleteName)}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#111"><h2>${c.title}</h2><p>${c.intro}</p><dl><dt>${c.athlete}</dt><dd><strong>${safe(athleteName)}</strong></dd><dt>${c.adult}</dt><dd><strong>${safe(adultName)}</strong></dd>${clubName ? `<dt>${c.club}</dt><dd><strong>${safe(clubName)}</strong></dd>` : ''}<dt>${c.scope}</dt><dd><strong>${safe(channelNames[channel] || channel)}</strong></dd></dl><p>${c.note}</p><a href="${safe(confirmUrl)}" style="background:#0f766e;color:#fff;padding:14px 24px;text-decoration:none;border-radius:8px;display:inline-block">${c.button}</a><p style="color:#64748b;font-size:12px;word-break:break-all">${safe(confirmUrl)}</p></div>`,
    };
  },
  parentCommunicationManagement: (athleteName, adultName, channel, managementUrl, language = 'sq') => {
    const safe = (value) => String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const languageKey = String(language || 'sq').toLowerCase();
    const copy = {
      sq: ['X TALENTI — menaxho pëlqimin e komunikimit', 'Pëlqimi për komunikim u regjistrua', 'Miratimi për', 'për të komunikuar me', 'u regjistrua për', 'Mund ta tërheqësh këtë miratim specifik në çdo kohë.', 'Menaxho ose tërhiq'],
      en: ['X TALENTI — manage communication approval', 'Communication approval recorded', 'Approval for', 'to communicate with', 'was recorded for', 'You can withdraw this specific approval at any time.', 'Manage or withdraw'],
      de: ['X TALENTI — Kommunikationsfreigabe verwalten', 'Kommunikationsfreigabe gespeichert', 'Die Freigabe für', 'zur Kommunikation mit', 'wurde erteilt für', 'Du kannst diese konkrete Freigabe jederzeit widerrufen.', 'Verwalten oder widerrufen'],
      fr: ['X TALENTI — gérer l’accord de communication', 'Accord de communication enregistré', 'L’accord pour', 'de communiquer avec', 'a été enregistré pour', 'Vous pouvez retirer cet accord spécifique à tout moment.', 'Gérer ou retirer'],
      it: ['X TALENTI — gestisci il consenso alla comunicazione', 'Consenso alla comunicazione registrato', 'Il consenso per', 'a comunicare con', 'è stato registrato per', 'Puoi revocare questo consenso specifico in qualsiasi momento.', 'Gestisci o revoca'],
      es: ['X TALENTI — gestionar la aprobación de comunicación', 'Aprobación de comunicación registrada', 'La aprobación para que', 'se comunique con', 'se registró para', 'Puedes retirar esta aprobación específica en cualquier momento.', 'Gestionar o retirar'],
      ro: ['X TALENTI — gestionează aprobarea comunicării', 'Aprobarea comunicării a fost înregistrată', 'Aprobarea pentru ca', 'să comunice cu', 'a fost înregistrată pentru', 'Poți retrage această aprobare specifică oricând.', 'Gestionează sau retrage'],
      hr: ['X TALENTI — upravljanje odobrenjem komunikacije', 'Odobrenje komunikacije je zabilježeno', 'Odobrenje za', 'komunikaciju s', 'zabilježeno je za', 'Ovo posebno odobrenje možeš povući u bilo kojem trenutku.', 'Upravljaj ili povuci'],
      tr: ['X TALENTI — iletişim onayını yönet', 'İletişim onayı kaydedildi', 'Şu kişinin', 'iletişim kurması için verilen onay', 'şu iletişim türü için kaydedildi', 'Bu özel onayı istediğin zaman geri çekebilirsin.', 'Yönet veya geri çek'],
    }[languageKey] || null;
    const c = copy || ['X TALENTI — manage communication approval', 'Communication approval recorded', 'Approval for', 'to communicate with', 'was recorded for', 'You can withdraw this specific approval at any time.', 'Manage or withdraw'];
    const channelLabels = {
      sq: { direct_message: 'mesazhe private', group_message: 'mesazhe në grup', video_call: 'telefonata me video', private_live_invitation: 'ftesa private live', guardian_mediated_group: 'grup me kujdestarin' },
      en: { direct_message: 'private messages', group_message: 'group messages', video_call: 'video calls', private_live_invitation: 'private live invitations', guardian_mediated_group: 'guardian-mediated group' },
      de: { direct_message: 'private Nachrichten', group_message: 'Gruppennachrichten', video_call: 'Videoanrufe', private_live_invitation: 'private Live-Einladungen', guardian_mediated_group: 'Gruppe mit erziehungsberechtigter Person' },
      fr: { direct_message: 'messages privés', group_message: 'messages de groupe', video_call: 'appels vidéo', private_live_invitation: 'invitations privées au direct', guardian_mediated_group: 'groupe avec le tuteur' },
      it: { direct_message: 'messaggi privati', group_message: 'messaggi di gruppo', video_call: 'videochiamate', private_live_invitation: 'inviti privati alle dirette', guardian_mediated_group: 'gruppo con il tutore' },
      es: { direct_message: 'mensajes privados', group_message: 'mensajes de grupo', video_call: 'videollamadas', private_live_invitation: 'invitaciones privadas al directo', guardian_mediated_group: 'grupo con el tutor' },
      ro: { direct_message: 'mesaje private', group_message: 'mesaje de grup', video_call: 'apeluri video', private_live_invitation: 'invitații private la transmisiune', guardian_mediated_group: 'grup cu tutorele' },
      hr: { direct_message: 'privatne poruke', group_message: 'grupne poruke', video_call: 'videopozivi', private_live_invitation: 'privatni pozivi u prijenos uživo', guardian_mediated_group: 'grupa sa skrbnikom' },
      tr: { direct_message: 'özel mesajlar', group_message: 'grup mesajları', video_call: 'görüntülü aramalar', private_live_invitation: 'özel canlı yayın davetleri', guardian_mediated_group: 'veliyle oluşturulan grup' },
    }[languageKey] || {};
    const channelLabel = channelLabels[channel] || channel;
    return {
      subject: c[0],
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#111"><h2>${c[1]}</h2><p>${c[2]} <strong>${safe(adultName)}</strong> ${c[3]} <strong>${safe(athleteName)}</strong> ${c[4]} <strong>${safe(channelLabel)}</strong>.</p><p>${c[5]}</p><a href="${safe(managementUrl)}" style="background:#0f766e;color:#fff;padding:14px 24px;text-decoration:none;border-radius:8px;display:inline-block">${c[6]}</a></div>`,
    };
  },

  importantNotice: (firstName, title, message, url, language = 'sq') => {
    const c = notificationCopy(language);
    return {
    subject: title || c.notice,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #9A6B12;">${title || c.notice}</h2>
        <p>${copyFor(language).hi} ${firstName || ''},</p>
        <p>${message || ''}</p>
        ${url ? `<a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}${url}"
           style="background: #9A6B12; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          ${c.open}
        </a>` : ''}
      </div>
    `,
  }; },

  rosterRejected: (data) => {
    const c = rosterCopy(data.language);
    return {
    subject: `${c.rejected} — ${data.clubName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${c.rejected}</h2>
        <p>${copyFor(data.language).hi} ${data.athleteName},</p>
        <p><strong>${data.clubName}</strong> ${c.reviewed} <strong>${data.position}</strong>.</p>
        ${data.message ? `<p style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 20px 0;">${data.message}</p>` : ''}
        <p>${c.encourage}</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/search?role=club"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          ${c.other}
        </a>
      </div>
    `
  }; }
};

// Send email function
const sendEmail = async (to, templateName, ...params) => {
  const resendApiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (resendApiKey && !isResendConfigured()) {
    console.error('❌ Email error: RESEND_FROM is required when RESEND_API_KEY is set');
    return { success: false, error: 'RESEND_FROM_NOT_CONFIGURED' };
  }

  if (!isEmailConfigured()) {
    console.warn('📧 Email skipped — configure Resend or SMTP credentials on server');
    return { success: false, error: 'EMAIL_NOT_CONFIGURED', skipped: true };
  }

  try {
    const template = emailTemplates[templateName](...params);

    if (resendApiKey) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM.trim(),
          to: [to],
          subject: template.subject,
          html: template.html,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const reason = result.message || result.error || `HTTP ${response.status}`;
        console.error('❌ Email API error:', templateName, reason);
        return { success: false, error: String(reason) };
      }

      console.log('✅ Email sent:', templateName, result.id || 'accepted by Resend');
      return { success: true, messageId: result.id || null };
    }

    const transport = getTransporter();
    if (!transport) {
      return { success: false, error: 'EMAIL_TRANSPORT_UNAVAILABLE' };
    }

    const mailOptions = {
      from: `"X TALENTI" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject: template.subject,
      html: template.html,
    };

    const info = await transport.sendMail(mailOptions);
    console.log('✅ Email sent:', templateName, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email error:', templateName, error.message);
    return { success: false, error: error.message };
  }
};

// Batch email sending
const sendBulkEmails = async (recipients, templateName, ...params) => {
  const results = await Promise.allSettled(
    recipients.map(email => sendEmail(email, templateName, ...params))
  );
  
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  console.log(`📧 Bulk email: ${successful} sent, ${failed} failed`);
  return { successful, failed };
};

module.exports = {
  sendEmail,
  sendBulkEmails,
  emailTemplates
};
