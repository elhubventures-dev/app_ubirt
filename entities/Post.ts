{
  "name": "Post",
  "type": "object",
  "properties": {
    "creator_name": {
      "type": "string"
    },
    "creator_handle": {
      "type": "string"
    },
    "creator_avatar": {
      "type": "string"
    },
    "media_url": {
      "type": "string"
    },
    "media_type": {
      "type": "string",
      "enum": [
        "video",
        "image"
      ],
      "default": "video"
    },
    "caption": {
      "type": "string"
    },
    "category": {
      "type": "string",
      "enum": [
        "tech",
        "fitness",
        "art",
        "cars",
        "meditation",
        "music",
        "gaming",
        "food",
        "travel",
        "general"
      ],
      "default": "general"
    },
    "likes": {
      "type": "number",
      "default": 0
    },
    "comments_count": {
      "type": "number",
      "default": 0
    },
    "shares": {
      "type": "number",
      "default": 0
    },
    "bookmarks": {
      "type": "number",
      "default": 0
    },
    "audio_title": {
      "type": "string"
    },
    "is_verified": {
      "type": "boolean",
      "default": false
    },
    "liked_by": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "bookmarked_by": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "creator_handle",
    "caption"
  ]
}