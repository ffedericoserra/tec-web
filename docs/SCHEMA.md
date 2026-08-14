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
- `passwordHash` - Bcrypt hashed password
- `savedMuseums` - Array of saved museum IDs
- `myVisits` - Array of created visit IDs
- `purchasedItems` - Array of purchased item IDs
- `walletBalance` - Virtual currency (default: 100)
- `activeSession` - Current session ID

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
- `type` - `standard` or `synchronized`
- `length` - `quick`, `normal`, or `deep` (description length preference)
- `quiz` - Optional quiz questions
- `isPublic`, `viewCount` - Visibility and stats

### Session
- `code` - Mnemonic code (e.g., `VERDE_TIGRE_55`)
- `owner` - Teacher user ID
- `visitId` - Associated visit
- `participants` - Array of joined users
- `currentItemIndex` - Shared navigation state
- `activities` - Log of participant actions
- `isActive`, `startedAt`, `endedAt` - Status

## Data Models Collections Details

### users
```js
{
  _id: ObjectId,
  username: String,              // unique, min 3 chars
  passwordHash: String,          // bcrypt
  savedMuseums: [ObjectId],      // refs Museum
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
      lengthCategory: String,    // '3s'|'15s'|'45s'
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
    username: String,
    joinedAt: Date,
    isActive: Boolean            // default: true
  }],
  currentItemIndex: Number,      // default: 0
  isActive: Boolean,             // default: true
  activities: [{
    participantId: ObjectId,     // refs User
    action: String,              // 'joined'|'left'|'tellMore'|'tellLess'|'simpler'|'tooSimple'
    timestamp: Date
  }],
  startedAt: Date,
  endedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: (code), (owner, isActive), (visitId)
// Virtuals: participantCount
```
