{
  "name": "Notification",
  "type": "object",
  "properties": {
    "recipient_email": {
      "type": "string"
    },
    "actor_name": {
      "type": "string"
    },
    "actor_avatar": {
      "type": "string"
    },
    "type": {
      "type": "string",
      "enum": [
        "like",
        "comment",
        "follow",
        "mention",
        "share",
        "system"
      ],
      "default": "like"
    },
    "content": {
      "type": "string"
    },
    "post_id": {
      "type": "string"
    },
    "is_read": {
      "type": "boolean",
      "default": false
    }
  },
  "required": [
    "recipient_email",
    "type",
    "content"
  ]
}