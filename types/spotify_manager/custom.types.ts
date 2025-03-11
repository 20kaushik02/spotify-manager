// APPLICATION
export type URIObject = {
  type: string;
  is_local: boolean;
  id: string;
  artist?: string;
  album?: string;
  title?: string;
  duration?: number;
};

export type User = {
  username: string;
  id: string;
};

export interface PlaylistModel_Pl {
  playlistID: string;
  playlistName: string;
}
export interface PlaylistModel extends PlaylistModel_Pl {
  userID: string;
}

export interface LinkModel_Edge {
  from: string;
  to: string;
}
