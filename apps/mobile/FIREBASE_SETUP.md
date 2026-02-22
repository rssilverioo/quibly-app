# Firebase Setup for Quibly

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project" and name it `quibly`
3. Disable Google Analytics (optional) and create the project

## 2. Enable Authentication

1. In the Firebase Console, go to **Authentication** > **Sign-in method**
2. Enable **Email/Password** provider

## 3. Create Firestore Database

1. Go to **Firestore Database** > **Create database**
2. Start in **production mode**
3. Choose your preferred region (e.g., `us-central1`)
4. Deploy the security rules from `firestore.rules`

## 4. Enable Firebase Storage

1. Go to **Storage** > **Get started**
2. Start in **production mode**
3. Deploy the security rules from `storage.rules`

## 5. Add Web App

Since this is an Expo managed workflow app, we use the Firebase JS SDK (web):

1. Go to **Project settings** > **General**
2. Under "Your apps", click the web icon `</>`
3. Register the app with a nickname (e.g., `quibly-mobile`)
4. Copy the Firebase config object

## 6. Configure the App

Update `apps/mobile/lib/firebase.ts` with your Firebase config:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

## 7. Deploy Security Rules

### Option A: Firebase CLI

```bash
npm install -g firebase-tools
firebase login
firebase init  # Select Firestore and Storage
firebase deploy --only firestore:rules,storage
```

### Option B: Firebase Console

Copy the contents of `firestore.rules` and `storage.rules` into the respective rules editors in the Firebase Console.

---

## Firestore Collections Schema

### `users/{uid}`

| Field                | Type     | Description                    |
|----------------------|----------|--------------------------------|
| `email`              | string   | User email                     |
| `username`           | string   | Display name                   |
| `handle`             | string   | Unique @handle                 |
| `avatar_url`         | string?  | Profile photo URL              |
| `bio`                | string?  | User bio                       |
| `total_xp`           | number   | Lifetime XP                    |
| `level`              | number   | Current level                  |
| `lock_in_score`      | number   | Lock-in score (0-100)          |
| `verified_hours`     | number   | Total verified study hours     |
| `current_streak`     | number   | Current streak in days         |
| `longest_streak`     | number   | Longest streak in days         |
| `total_study_minutes`| number   | Total study time in minutes    |
| `created_at`         | string   | ISO timestamp                  |

### `subjects/{id}`

| Field      | Type   | Description            |
|------------|--------|------------------------|
| `user_id`  | string | Owner user ID          |
| `name`     | string | Subject name           |
| `color`    | string | Hex color code         |
| `icon`     | string | Emoji icon             |

### `leagues/{id}`

| Field          | Type     | Description                        |
|----------------|----------|------------------------------------|
| `name`         | string   | League name                        |
| `description`  | string?  | League description                 |
| `owner_id`     | string   | Creator user ID                    |
| `start_date`   | string   | ISO date (YYYY-MM-DD)              |
| `end_date`     | string   | ISO date (YYYY-MM-DD)              |
| `privacy`      | string   | `public` or `private`              |
| `mode`         | string   | `easy`, `competitive`, `hardcore`  |
| `status`       | string   | `active` or `completed`            |
| `invite_code`  | string   | 8-char unique invite code          |
| `max_members`  | number   | Maximum member count               |
| `members`      | string[] | Array of member user IDs           |
| `member_count` | number   | Current member count               |
| `created_at`   | string   | ISO timestamp                      |

### `leagues/{id}/members/{id}`

| Field            | Type   | Description                |
|------------------|--------|----------------------------|
| `user_id`        | string | Member user ID             |
| `role`           | string | `owner` or `member`        |
| `total_sp`       | number | All-time study points      |
| `weekly_sp`      | number | Weekly study points        |
| `monthly_sp`     | number | Monthly study points       |
| `verified_hours` | number | Verified study hours       |
| `joined_at`      | string | ISO timestamp              |

### `leagues/{id}/feed/{id}`

| Field                    | Type                       | Description                     |
|--------------------------|----------------------------|---------------------------------|
| `league_id`              | string                     | Parent league ID                |
| `user_id`                | string                     | Author user ID                  |
| `session_id`             | string                     | Related session ID              |
| `subject_id`             | string                     | Subject ID                      |
| `username`               | string                     | Denormalized username           |
| `avatar_url`             | string?                    | Denormalized avatar URL         |
| `subject_name`           | string                     | Denormalized subject name       |
| `subject_color`          | string                     | Denormalized subject color      |
| `show_proof_photo`       | boolean                    | Whether to show proof indicator |
| `proof_photo_url`        | string?                    | Proof photo URL                 |
| `total_duration_minutes` | number                     | Session duration                |
| `points_earned`          | number                     | SP earned                       |
| `is_verified`            | boolean                    | Whether session is verified     |
| `reactions`              | map<string, string[]>      | `{ emoji: [userId, ...] }`      |
| `comment_count`          | number                     | Number of comments              |
| `created_at`             | string                     | ISO timestamp                   |

### `leagues/{id}/feed/{id}/comments/{id}`

| Field        | Type    | Description              |
|--------------|---------|--------------------------|
| `post_id`    | string  | Parent post ID           |
| `user_id`    | string  | Author user ID           |
| `username`   | string  | Denormalized username    |
| `avatar_url` | string? | Denormalized avatar URL  |
| `content`    | string  | Comment text             |
| `created_at` | string  | ISO timestamp            |

### `leagues/{id}/chat/{id}`

| Field          | Type    | Description                     |
|----------------|---------|---------------------------------|
| `league_id`    | string  | Parent league ID                |
| `user_id`      | string? | Sender (null for system)        |
| `username`     | string  | Denormalized username           |
| `avatar_url`   | string? | Denormalized avatar URL         |
| `content`      | string  | Message text                    |
| `message_type` | string  | `text` or `system`              |
| `created_at`   | string  | ISO timestamp                   |

### `sessions/{id}`

| Field                      | Type          | Description                    |
|----------------------------|---------------|--------------------------------|
| `user_id`                  | string        | Session owner                  |
| `subject_id`               | string        | Subject studied                |
| `league_id`                | string?       | Associated league              |
| `timer_mode`               | string        | `pomodoro`, `deep_focus`, etc. |
| `work_duration`            | number        | Work period in minutes         |
| `break_duration`           | number        | Break period in minutes        |
| `proof_mode`               | boolean       | Proof mode enabled             |
| `status`                   | string        | `active` or `completed`        |
| `total_duration_minutes`   | number        | Actual study time              |
| `pomodoro_cycles_completed`| number        | Completed pomodoro cycles      |
| `points_earned`            | number        | SP earned                      |
| `xp_earned`                | number        | XP earned                      |
| `is_verified`              | boolean       | All proofs passed              |
| `proof_checks`             | array         | Array of proof check objects   |
| `started_at`               | string        | ISO timestamp                  |
| `ended_at`                 | string?       | ISO timestamp                  |

---

## Firestore Indexes

Create the following composite indexes in the Firebase Console under **Firestore > Indexes**:

1. **leagues** - `members` (Array contains) + `created_at` (Descending)
2. **leagues** - `members` (Array contains) + `status` (Ascending) + `created_at` (Descending)
3. **leagues/{id}/members** - `total_sp` (Descending)
4. **leagues/{id}/members** - `weekly_sp` (Descending)
5. **leagues/{id}/members** - `monthly_sp` (Descending)
6. **leagues/{id}/feed** - `created_at` (Descending)
7. **leagues/{id}/chat** - `created_at` (Ascending)
8. **sessions** - `user_id` (Ascending) + `started_at` (Descending)

---

## Storage Structure

```
proofs/
  {userId}/
    {sessionId}/
      proof_{userId}_{sessionId}_{checkIndex}_{timestamp}.jpg

avatars/
  {userId}/
    avatar_{userId}_{timestamp}.jpg
```

## Running the App

```bash
cd apps/mobile
npm install
npx expo start
```
