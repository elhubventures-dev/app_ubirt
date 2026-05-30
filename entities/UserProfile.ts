{
  "name": "UserProfile",
  "type": "object",
  "properties": {
    "user_email": {
      "type": "string"
    },
    "handle": {
      "type": "string"
    },
    "bio": {
      "type": "string"
    },
    "avatar_url": {
      "type": "string"
    },
    "followers_count": {
      "type": "number",
      "default": 0
    },
    "following_count": {
      "type": "number",
      "default": 0
    },
    "posts_count": {
      "type": "number",
      "default": 0
    },
    "interests": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "phone": {
      "type": "string"
    },
    "is_verified": {
      "type": "boolean",
      "default": false
    },
    "theme": {
      "type": "string",
      "enum": [
        "dark",
        "light"
      ],
      "default": "dark"
    },
    "notifications_enabled": {
      "type": "boolean",
      "default": true
    }
  },
  "required": [
    "user_email",
    "handle"
  ]
}