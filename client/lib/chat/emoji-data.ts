/**
 * Curated native-emoji set for the chat composer. Native glyphs keep the bundle small and need no
 * network requests; each entry carries search keywords. Order within a category is display order.
 */
export type Emoji = { char: string; name: string; keywords?: string };
export type EmojiCategory = { id: string; label: string; icon: string; emojis: Emoji[] };

const e = (char: string, name: string, keywords?: string): Emoji => ({ char, name, keywords });

export const emojiCategories: EmojiCategory[] = [
  {
    id: "smileys", label: "Smileys", icon: "😀", emojis: [
      e("😀", "grinning", "smile happy"), e("😃", "smiley", "happy joy"), e("😄", "smile", "happy laugh"), e("😁", "grin", "teeth"),
      e("😆", "laughing", "lol"), e("😅", "sweat smile", "relief nervous"), e("🤣", "rolling on the floor laughing", "rofl lol"), e("😂", "joy", "tears laugh lol"),
      e("🙂", "slightly smiling"), e("🙃", "upside down", "silly sarcasm"), e("😉", "wink"), e("😊", "blush", "happy shy"),
      e("😇", "innocent", "angel halo"), e("🥰", "smiling with hearts", "love adore"), e("😍", "heart eyes", "love crush"), e("🤩", "star struck", "wow amazing"),
      e("😘", "kissing heart", "kiss love"), e("😋", "yum", "tasty delicious"), e("😛", "tongue out", "playful"), e("😜", "winking tongue", "crazy joke"),
      e("🤪", "zany", "crazy goofy"), e("🤑", "money mouth", "rich"), e("🤗", "hugging", "hug"), e("🤭", "hand over mouth", "oops giggle"),
      e("🤫", "shushing", "quiet secret"), e("🤔", "thinking", "hmm consider"), e("🤐", "zipper mouth", "secret"), e("🤨", "raised eyebrow", "skeptical sus"),
      e("😐", "neutral", "meh"), e("😑", "expressionless", "blank"), e("😶", "no mouth", "speechless"), e("😏", "smirk", "smug"),
      e("😒", "unamused", "meh annoyed"), e("🙄", "rolling eyes", "whatever"), e("😬", "grimacing", "awkward yikes"), e("😮‍💨", "exhaling", "sigh relief"),
      e("😌", "relieved", "calm"), e("😔", "pensive", "sad"), e("😪", "sleepy", "tired"), e("😴", "sleeping", "zzz tired"),
      e("😷", "mask", "sick ill"), e("🤒", "thermometer", "sick fever"), e("🤢", "nauseated", "sick gross"), e("🥵", "hot", "heat sweat"),
      e("🥶", "cold", "freezing"), e("🥴", "woozy", "dizzy drunk"), e("😵‍💫", "spiral eyes", "dizzy"), e("🤯", "exploding head", "mind blown"),
      e("🤠", "cowboy", "yeehaw"), e("🥳", "partying", "party celebrate birthday"), e("😎", "sunglasses", "cool"), e("🤓", "nerd", "geek glasses"),
      e("🧐", "monocle", "inspect curious"), e("😕", "confused"), e("😟", "worried"), e("🙁", "slightly frowning", "sad"),
      e("😮", "open mouth", "wow surprised"), e("😯", "hushed", "surprised"), e("😲", "astonished", "shocked"), e("😳", "flushed", "embarrassed"),
      e("🥺", "pleading", "puppy eyes please"), e("🥹", "holding back tears", "touched"), e("😢", "crying", "sad tear"), e("😭", "sobbing", "cry sad"),
      e("😱", "screaming", "scared fear"), e("😖", "confounded"), e("😣", "persevering"), e("😩", "weary", "tired"),
      e("😤", "triumph", "huff proud"), e("😡", "pouting", "angry mad"), e("😠", "angry", "mad"), e("🤬", "cursing", "swear angry"),
      e("😈", "smiling devil", "evil"), e("💀", "skull", "dead lol"), e("💩", "poop"), e("🤡", "clown"),
      e("👻", "ghost", "boo"), e("👽", "alien", "ufo"), e("🤖", "robot", "bot"), e("😺", "smiling cat"),
    ],
  },
  {
    id: "people", label: "People", icon: "👋", emojis: [
      e("👋", "wave", "hello hi bye"), e("🤚", "raised back of hand"), e("✋", "raised hand", "stop high five"), e("🖖", "vulcan salute", "spock"),
      e("👌", "ok hand", "perfect"), e("🤌", "pinched fingers", "chef kiss"), e("✌️", "victory", "peace"), e("🤞", "crossed fingers", "luck hope"),
      e("🤟", "love you gesture"), e("🤘", "rock on", "metal"), e("🤙", "call me", "shaka"), e("👈", "point left"),
      e("👉", "point right"), e("👆", "point up"), e("👇", "point down"), e("☝️", "index up", "one"),
      e("👍", "thumbs up", "yes like approve +1"), e("👎", "thumbs down", "no dislike -1"), e("✊", "raised fist", "power"), e("👊", "fist bump", "punch"),
      e("👏", "clap", "applause bravo"), e("🙌", "raising hands", "celebrate yay"), e("🫶", "heart hands", "love"), e("👐", "open hands"),
      e("🤝", "handshake", "deal agree"), e("🙏", "folded hands", "please thanks pray"), e("✍️", "writing"), e("💪", "flexed biceps", "strong muscle"),
      e("🧠", "brain", "smart think"), e("👀", "eyes", "look watching"), e("👁️", "eye"), e("👅", "tongue"),
      e("🫡", "saluting", "respect yes sir"), e("🫠", "melting", "embarrassed"), e("🤷", "shrug", "idk whatever"), e("🤦", "facepalm", "ugh"),
      e("🙋", "raising hand", "me question"), e("🙇", "bowing", "sorry thanks"), e("🧑‍💻", "technologist", "coder developer"), e("🕺", "dancing man", "dance"),
      e("💃", "dancing woman", "dance"), e("🏃", "running", "run"), e("🧘", "meditation", "yoga calm"), e("👶", "baby"),
    ],
  },
  {
    id: "nature", label: "Nature", icon: "🐶", emojis: [
      e("🐶", "dog", "puppy"), e("🐱", "cat", "kitten"), e("🐭", "mouse"), e("🐹", "hamster"),
      e("🐰", "rabbit", "bunny"), e("🦊", "fox"), e("🐻", "bear"), e("🐼", "panda"),
      e("🐨", "koala"), e("🐯", "tiger"), e("🦁", "lion"), e("🐮", "cow"),
      e("🐷", "pig"), e("🐸", "frog"), e("🐵", "monkey"), e("🙈", "see no evil", "monkey shy"),
      e("🐔", "chicken"), e("🐧", "penguin"), e("🐦", "bird"), e("🦆", "duck"),
      e("🦉", "owl"), e("🐺", "wolf"), e("🦄", "unicorn"), e("🐝", "bee"),
      e("🦋", "butterfly"), e("🐢", "turtle", "slow"), e("🐍", "snake"), e("🐙", "octopus"),
      e("🐬", "dolphin"), e("🐳", "whale"), e("🦈", "shark"), e("🌵", "cactus"),
      e("🌲", "evergreen", "tree"), e("🌳", "tree"), e("🌴", "palm tree", "beach"), e("🌱", "seedling", "grow plant"),
      e("🍀", "four leaf clover", "luck"), e("🍁", "maple leaf", "autumn fall"), e("🌸", "cherry blossom", "flower spring"), e("🌹", "rose", "flower"),
      e("🌻", "sunflower"), e("🌈", "rainbow"), e("☀️", "sun", "sunny"), e("🌙", "crescent moon", "night"),
      e("⭐", "star"), e("🌟", "glowing star", "shine"), e("⚡", "lightning", "zap fast"), e("🔥", "fire", "lit hot"),
      e("💧", "droplet", "water"), e("🌊", "wave", "ocean sea"), e("❄️", "snowflake", "cold winter"), e("☁️", "cloud"),
    ],
  },
  {
    id: "food", label: "Food", icon: "🍕", emojis: [
      e("🍎", "apple"), e("🍊", "orange"), e("🍋", "lemon"), e("🍌", "banana"),
      e("🍉", "watermelon"), e("🍇", "grapes"), e("🍓", "strawberry"), e("🍒", "cherries"),
      e("🍑", "peach"), e("🥭", "mango"), e("🍍", "pineapple"), e("🥥", "coconut"),
      e("🥑", "avocado"), e("🌶️", "hot pepper", "spicy"), e("🥕", "carrot"), e("🌽", "corn"),
      e("🍞", "bread"), e("🥐", "croissant"), e("🧀", "cheese"), e("🥚", "egg"),
      e("🍳", "cooking", "fried egg breakfast"), e("🥞", "pancakes"), e("🥓", "bacon"), e("🍔", "hamburger", "burger"),
      e("🍟", "fries"), e("🍕", "pizza"), e("🌭", "hot dog"), e("🌮", "taco"),
      e("🌯", "burrito"), e("🥗", "salad"), e("🍝", "spaghetti", "pasta"), e("🍜", "ramen", "noodles"),
      e("🍣", "sushi"), e("🍱", "bento"), e("🍦", "ice cream"), e("🍩", "doughnut", "donut"),
      e("🍪", "cookie"), e("🎂", "birthday cake"), e("🍰", "cake", "shortcake"), e("🧁", "cupcake"),
      e("🍫", "chocolate"), e("🍿", "popcorn", "movie"), e("☕", "coffee", "hot drink tea"), e("🍵", "tea", "matcha"),
      e("🧋", "bubble tea", "boba"), e("🥤", "soft drink", "soda"), e("🍺", "beer"), e("🍷", "wine"),
    ],
  },
  {
    id: "activities", label: "Activities", icon: "🎮", emojis: [
      e("🎮", "video game", "gaming controller"), e("🕹️", "joystick", "arcade"), e("♟️", "chess pawn", "chess"), e("🎲", "game die", "dice"),
      e("🧩", "puzzle piece"), e("🎯", "direct hit", "target bullseye"), e("🎳", "bowling"), e("🏓", "ping pong", "table tennis pong"),
      e("⚽", "soccer", "football"), e("🏀", "basketball"), e("🏈", "american football"), e("⚾", "baseball"),
      e("🎾", "tennis"), e("🏐", "volleyball"), e("🏆", "trophy", "win champion"), e("🥇", "gold medal", "first winner"),
      e("🥈", "silver medal", "second"), e("🥉", "bronze medal", "third"), e("🏅", "medal"), e("🎖️", "military medal"),
      e("🎉", "party popper", "celebrate tada congrats"), e("🎊", "confetti ball", "celebrate"), e("🎈", "balloon", "party"), e("🎁", "gift", "present"),
      e("🎄", "christmas tree"), e("🎃", "jack o lantern", "halloween"), e("🎆", "fireworks"), e("✨", "sparkles", "magic shiny"),
      e("🎵", "musical note", "music"), e("🎶", "notes", "music song"), e("🎧", "headphones", "music listen"), e("🎤", "microphone", "sing karaoke"),
      e("🎸", "guitar"), e("🎹", "piano", "keyboard"), e("🥁", "drum"), e("🎨", "art palette", "paint"),
      e("🎬", "clapper", "movie film"), e("📸", "camera flash", "photo"), e("🚀", "rocket", "launch ship"), e("✈️", "airplane", "travel"),
    ],
  },
  {
    id: "objects", label: "Objects", icon: "💡", emojis: [
      e("💡", "light bulb", "idea"), e("🔦", "flashlight"), e("💻", "laptop", "computer"), e("🖥️", "desktop computer"),
      e("⌨️", "keyboard"), e("🖱️", "mouse"), e("📱", "phone", "mobile"), e("☎️", "telephone"),
      e("🔋", "battery"), e("🔌", "plug"), e("💾", "floppy disk", "save"), e("📀", "dvd"),
      e("📷", "camera"), e("📺", "television", "tv"), e("⏰", "alarm clock"), e("⌛", "hourglass", "time wait"),
      e("📚", "books", "study read"), e("📖", "open book", "read"), e("📝", "memo", "note write"), e("✏️", "pencil"),
      e("📌", "pushpin", "pin"), e("📎", "paperclip", "attach"), e("✂️", "scissors"), e("🗂️", "dividers", "folder"),
      e("📅", "calendar", "date"), e("📈", "chart increasing", "growth up"), e("📉", "chart decreasing", "down"), e("📊", "bar chart", "stats"),
      e("🔒", "locked", "secure"), e("🔓", "unlocked"), e("🔑", "key"), e("🔨", "hammer", "build"),
      e("🛠️", "tools", "fix build"), e("⚙️", "gear", "settings"), e("🧪", "test tube", "experiment"), e("🔭", "telescope"),
      e("💰", "money bag", "rich"), e("💸", "money wings", "spend"), e("💳", "credit card"), e("📦", "package", "box ship"),
      e("✉️", "envelope", "mail"), e("📣", "megaphone", "announce"), e("🔔", "bell", "notification"), e("🏠", "house", "home"),
    ],
  },
  {
    id: "symbols", label: "Symbols", icon: "❤️", emojis: [
      e("❤️", "red heart", "love"), e("🧡", "orange heart", "love nook"), e("💛", "yellow heart"), e("💚", "green heart"),
      e("💙", "blue heart"), e("💜", "purple heart"), e("🖤", "black heart"), e("🤍", "white heart"),
      e("🤎", "brown heart"), e("💔", "broken heart", "sad"), e("❤️‍🔥", "heart on fire", "passion"), e("💕", "two hearts", "love"),
      e("💖", "sparkling heart"), e("💯", "hundred points", "100 perfect"), e("💢", "anger symbol"), e("💥", "collision", "boom"),
      e("💫", "dizzy star"), e("💬", "speech balloon", "chat comment"), e("💭", "thought balloon", "think"), e("💤", "zzz", "sleep"),
      e("✅", "check mark button", "done yes"), e("☑️", "check box"), e("✔️", "check mark", "yes done"), e("❌", "cross mark", "no wrong"),
      e("❎", "cross mark button"), e("➕", "plus", "add"), e("➖", "minus"), e("❓", "question", "what"),
      e("❗", "exclamation", "important"), e("‼️", "double exclamation"), e("⚠️", "warning", "caution"), e("🚫", "prohibited", "no forbidden"),
      e("⛔", "no entry", "stop"), e("🆗", "ok button"), e("🆕", "new button"), e("🆒", "cool button"),
      e("🔴", "red circle"), e("🟠", "orange circle"), e("🟢", "green circle", "online"), e("🔵", "blue circle"),
      e("⬆️", "up arrow"), e("⬇️", "down arrow"), e("➡️", "right arrow"), e("⬅️", "left arrow"),
      e("🔁", "repeat"), e("🔄", "refresh", "reload sync"), e("♻️", "recycle"), e("🏳️‍🌈", "rainbow flag", "pride"),
    ],
  },
];

export const allEmojis: Emoji[] = emojiCategories.flatMap(category => category.emojis);
