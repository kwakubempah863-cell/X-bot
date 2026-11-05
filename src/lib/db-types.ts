// Auto-generated from your database schema — do not edit by hand.
// Regenerates automatically whenever a table is created or altered.

export type BotCommandsRow = {
  id: string
  userId: string
  name: string
  category: string
  description: string
  usage: string
  permissionLevel: string
  cooldownSeconds: string
  enabled: boolean
  aliases: string | null
  createdAt: string
}

export type BotGroupsRow = {
  id: string
  userId: string
  groupId: string
  name: string | null
  description: string | null
  memberCount: string | null
  adminsCount: string | null
  profilePictureUrl: string | null
  prefix: string
  rules: string | null
  theme: string
  antiLink: boolean
  antiSpam: boolean
  welcomeEnabled: boolean
  connectionState: string
  createdAt: string
  updatedAt: string
}

export type BotSettingsRow = {
  id: string
  userId: string
  botName: string
  creatorName: string
  defaultPrefix: string
  ownerUsername: string | null
  ownerJid: string | null
  ownerNumber: string | null
  connectionMode: string
  aiProvider: string
  updatedAt: string
}

export type MenuImagesRow = {
  id: string
  userId: string
  url: string
  category: string
  active: boolean
  usageCount: string
  createdAt: string
}
