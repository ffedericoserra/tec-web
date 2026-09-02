# Data Schema

## Database

**Connection:** `mongodb://<user>:<pass>@<host>/<dbname>?authSource=admin`

| Environment | Database | User | Host |
|-------------|----------|------|------|
| Production | `artaround` | `site242557` | `?(localhost:27017 from inside node container)?` |
| Development | `artaround` | `site242557` | `localhost:27017` |

## Data Models Overview

### User
- `username` - Unique identifier
- `email` - Contact address (collected at registration)
- `passwordHash` - Bcrypt hashed password
- `avatarUrl` - Profile image
- `language` - Preferred interface language (`it` or `en`, default: `it`)
- `savedMuseums` - Array of saved museum IDs
- `savedVisits` - Array of favourited visit IDs
- `myVisits` - Array of created visit IDs
- `purchasedItems` - Array of purchased item IDs
- `walletBalance` - Virtual currency (default: 100)
- `activeSession` - Current session ID

Legacy user documents that still contain the former `es` UI preference are serialized
as `en` and normalized to `en` on their next validation/save. `es` is not accepted by
the account-language API; it remains valid only for authored Item text metadata.

### Museum
- `name`, `slug` - Identification
- `address`, `description`, `imageUrl` - Details
- `theme` - UI customization (primaryColor, secondaryColor, font)
- `mapData` - Map image and geo bounds
- `pointsOfInterest` - Logistic points (toilet, exit, bar, stairs, entrance, shop)

### Content
- `type` - `Artwork`, `Artist`, `Movement`, `Place`
- `museumId` - Parent museum
- `universalId` - External ID (e.g., Wikidata)
- `name`, `author`, `year` - Metadata
- `coordinates` - Location in museum
- `qrCode` - QR code identifier
- `imageUrl` - Artwork image. Not written by hand: `scripts/load-museum.js` fills it from `uploads/contents/<universalId>.<ext>` if that file exists (see README, "Media assets"). An explicit value in the museum config overrides it.

### Item
- `contentId` - Links to Content.universalId
- `creatorId` - Creator user
- `targetAudience` - Description of intended audience
- `descriptions` - Array of tones, each with texts at different lengths
- `price`, `license`, `isPublic` - Marketplace properties
- `associatedContents` - Related Content IDs

### Visit
- `title`, `slug`, `description`, `imageUrl` - Metadata
- `museumId`, `creatorId` - References
- `sequence` - Ordered array of items with navigation directions
- `blocks` - Section grouping laid over `sequence`; a block is either `artwork` (items) or `questions` (prompts answered during a synchronized visit)
- `type` - `standard` or `synchronized` (the marketplace derives it: any question makes a visit synchronized)
- `length` - `quick`, `normal`, or `deep` (description length preference)
- `quiz` - Optional end-of-visit quiz questions (distinct from `blocks[].questions`)
- `isPublic`, `viewCount` - Visibility and stats

**`sequence` and `blocks` describe the same visit twice.** `sequence` is the flat ordered item list; `blocks` groups those items and interleaves question sections between them. A synchronized session walks a *step* list rebuilt from `blocks`, falling back to one step per `sequence` entry when `blocks` is empty. That rebuild exists in two places — `frontend-navigator/src/pages/VisitRun.jsx` and `src/controllers/session.controller.js` — and they must agree.

### Session
- `code` - Mnemonic code (e.g., `VERDE_TIGRE_55`)
- `owner` - Teacher user ID
- `visitId` - Associated visit
- `participants` - Array of joined users, each carrying their `quizAnswers` and `quizScore`
- `currentItemIndex` - Shared position within `visit.sequence`
- `currentStepIndex` - Shared position within the rebuilt step list (artworks + question sections)
- `activities` - Log of participant actions
- `messages` - Persisted group chat, so reloads and late joins see the backlog
- `sectionResponses` - Answers to `blocks[].questions`, visible to the owner; multiple-choice answers carry an owner-only `isCorrect` result without exposing `correctIndex`
- `quizStarted` - Persisted, so a student reloading mid-quiz returns to the quiz
- `isActive`, `startedAt`, `endedAt` - Status

## Data Models Collections Details

### users
```js
{
  _id: ObjectId,
  username: String,              // unique, min 3 chars
  email: String,
  passwordHash: String,          // bcrypt (virtual `password` setter → pre-save hook)
  avatarUrl: String,
  language: String,              // 'it'|'en', default: 'it'
  savedMuseums: [ObjectId],      // refs Museum
  savedVisits: [ObjectId],       // refs Visit (favourites)
  myVisits: [ObjectId],          // refs Visit
  purchasedItems: [ObjectId],    // refs Item
  walletBalance: Number,         // default: 100
  activeSession: String,         // current session code
  createdAt: Date,
  updatedAt: Date
}
```

### museums
```js
{
  _id: ObjectId,
  name: String,
  slug: String,                  // unique, auto-generated
  address: String,
  description: String,
  imageUrl: String,
  theme: {
    primaryColor: String,        // default: '#1a1a1a'
    secondaryColor: String,      // default: '#ffffff'
    font: String                 // default: 'Inter'
  },
  mapData: {
    imageUrl: String,
    bounds: { north, south, east, west: Number },
    center: { lat, lng: Number }
  },
  pointsOfInterest: [{
    type: String,                // 'toilet'|'exit'|'bar'|'stairs'|'entrance'|'shop'
    coordinates: { lat, lng: Number },
    label: String
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### contents
```js
{
  _id: ObjectId,
  type: String,                  // 'Artwork'|'Artist'|'Movement'|'Place'
  museumId: ObjectId,            // refs Museum
  universalId: String,           // required, unique and immutable
  name: String,
  author: String,
  year: String,
  imageRecognitionUrl: String,
  coordinates: { lat, lng: Number },
  qrCode: String,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: (museumId, type), (universalId)
```

### items
```js
{
  _id: ObjectId,
  contentId: String,             // links to Content.universalId
  creatorId: ObjectId,           // refs User
  targetAudience: String,
  descriptions: [{
    tone: String,                // 'easy'|'medium'|'complex'
    texts: [{
      text: String,
      lengthCategory: String,    // '15s'|'30s'|'60s'
      language: String,          // default: 'it'
      isAiGenerated: Boolean     // default: false
    }]
  }],
  price: Number,                 // default: 0
  license: String,               // 'CC-BY'|'CC-BY-SA'|'CC-BY-NC'|'Copyright'|'Public Domain'
  isPublic: Boolean,             // default: false
  salesCount: Number,            // completed acquisitions, default: 0
  revenue: Number,               // total creator revenue, default: 0
  associatedContents: [ObjectId], // refs Content
  createdAt: Date,
  updatedAt: Date
}
// Indexes: (contentId), (creatorId), (isPublic)
```

### visits
```js
{
  _id: ObjectId,
  title: String,
  slug: String,                  // auto-generated
  museumId: ObjectId,            // refs Museum
  creatorId: ObjectId,           // refs User
  description: String,
  imageUrl: String,
  sequence: [{
    itemId: ObjectId,            // refs Item
    order: Number,
    nextDirections: String,
    prevDirections: String,
    overrideImage: String
  }],
  blocks: [{
    type: String,                // 'artwork'|'questions', default: 'artwork'
    blockName: String,           // default: 'Mainboard'
    items: [ObjectId],           // refs Item — the artworks grouped in this block
    questions: [{
      prompt: String,            // required
      answerType: String,        // 'open'|'multiple-choice', default: 'open'
      options: [String],         // multiple-choice only
      correctIndex: Number       // multiple-choice only
    }]
  }],
  length: String,                // 'quick'|'normal'|'deep', default: 'normal'
  type: String,                  // 'standard'|'synchronized', default: 'standard'
  sessionCode: String,           // unique, sparse
  quiz: [{
    question: String,
    options: [String],
    correctIndex: Number
  }],
  isPublic: Boolean,             // default: true
  viewCount: Number,             // default: 0
  createdAt: Date,
  updatedAt: Date
}
// Indexes: (museumId, isPublic), (creatorId), (sessionCode)
// Virtuals: itemCount
```

### sessions
```js
{
  _id: ObjectId,
  code: String,                  // unique, uppercase (e.g., 'ROSSO_LEONE_42')
  owner: ObjectId,               // refs User (teacher)
  visitId: ObjectId,             // refs Visit
  participants: [{
    userId: ObjectId,            // refs User
    username: String,            // denormalised: panels render a name per row
    joinedAt: Date,
    isActive: Boolean,           // default: true
    quizAnswers: [{ questionIndex: Number, selectedIndex: Number }],
    quizScore: Number
  }],
  currentItemIndex: Number,      // default: 0 — position in visit.sequence
  currentStepIndex: Number,      // default: 0 — position in the rebuilt step list
  isActive: Boolean,             // default: true
  activities: [{
    participantId: ObjectId,     // refs User
    action: String,              // 'joined'|'left'|'more'|'simpler'|'author'|'year'|'exit'|'map'
                                 //   + legacy 'tellMore'|'tellLess'|'tooSimple' (no UI, kept so
                                 //   old sessions still validate)
    timestamp: Date
  }],
  messages: [{                   // persisted chat — backlog survives reload / late join
    userId: ObjectId,            // refs User
    username: String,
    text: String,
    timestamp: Date
  }],
  sectionResponses: [{           // answers to visit.blocks[].questions; owner-visible only
    sectionId: String,
    questionId: String,
    userId: ObjectId,            // refs User
    username: String,
    answerType: String,          // 'open'|'multiple-choice'
    text: String,                // open answers, max 1000 chars
    selectedIndex: Number,       // multiple-choice answers
    isCorrect: Boolean,          // owner-only result for multiple-choice answers
    submittedAt: Date
  }],
  quizStarted: Boolean,          // persisted so a mid-quiz reload returns to the quiz
  startedAt: Date,
  endedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: (code), (owner, isActive), (visitId)
// Virtuals: participantCount
```
