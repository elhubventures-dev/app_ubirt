{
  "name": "Message",
  "type": "object",
  "properties": {
    "conversation_id": {
      "type": "string"
    },
    "sender_email": {
      "type": "string"
    },
    "sender_name": {
      "type": "string"
    },
    "content": {
      "type": "string"
    },
    "message_type": {
      "type": "string",
      "enum": [
        "text",
        "image",
        "audio"
      ],
      "default": "text"
    },
    "media_url": {
      "type": "string"
    },
    "is_read": {
      "type": "boolean",
      "default": false
    }
  },
  "required": [
    "conversation_id",
    "sender_email",
    "content"
  ]
}