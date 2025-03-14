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
