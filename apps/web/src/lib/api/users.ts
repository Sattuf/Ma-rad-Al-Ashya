import { api } from './auth';

/** Server shape (users-service, snake_case). */
interface ServerProfile {
  id: string;
  email?: string | null;
  full_name?: string | null;
  bio?: string | null;
  city?: string | null;
  avatar_url?: string | null;
  notification_messages?: boolean;
  notification_listings?: boolean;
  notification_transactions?: boolean;
  is_identity_verified?: boolean;
  created_at?: string;
}

export interface NotificationSettings {
  messages: boolean;
  listings: boolean;
  transactions: boolean;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  bio: string;
  location: string;
  avatar?: string;
  isIdentityVerified: boolean;
  createdAt?: string;
  notifications: NotificationSettings;
}

export interface PublicProfile {
  id: string;
  name: string;
  bio: string;
  location: string;
  avatar?: string;
  isIdentityVerified: boolean;
  createdAt?: string;
}

const toProfile = (u: ServerProfile): Profile => ({
  id: u.id,
  name: u.full_name ?? '',
  email: u.email ?? '',
  bio: u.bio ?? '',
  location: u.city ?? '',
  avatar: u.avatar_url ?? undefined,
  isIdentityVerified: !!u.is_identity_verified,
  createdAt: u.created_at,
  notifications: {
    messages: u.notification_messages ?? true,
    listings: u.notification_listings ?? true,
    transactions: u.notification_transactions ?? true,
  },
});

const NOTIFICATION_FIELDS: Record<keyof NotificationSettings, string> = {
  messages: 'notification_messages',
  listings: 'notification_listings',
  transactions: 'notification_transactions',
};

/**
 * users-service client. The server speaks snake_case; the UI uses camelCase — mapping
 * lives here so pages never send fields the server silently drops.
 */
export const userApi = {
  getProfile: async (): Promise<Profile> => {
    const response = await api.get('/users/profile');
    return toProfile(response.data);
  },

  getUser: async (id: string): Promise<PublicProfile> => {
    const response = await api.get(`/users/${id}`);
    const { notifications: _n, email: _e, ...rest } = toProfile(response.data);
    return rest;
  },

  /** Email and phone are identity data owned by auth-service and change only through verification. */
  updateProfile: async (data: { name?: string; bio?: string; location?: string }): Promise<Profile> => {
    const response = await api.put('/users/profile', {
      full_name: data.name,
      bio: data.bio,
      city: data.location,
    });
    return toProfile(response.data);
  },

  uploadAvatar: async (formData: FormData): Promise<Profile> => {
    const response = await api.post('/users/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return toProfile(response.data);
  },

  updateNotifications: async (changes: Partial<NotificationSettings>): Promise<Profile> => {
    const body = Object.fromEntries(
      Object.entries(changes).map(([key, value]) => [NOTIFICATION_FIELDS[key as keyof NotificationSettings], value]),
    );
    const response = await api.put('/users/notifications', body);
    return toProfile(response.data);
  },
};
