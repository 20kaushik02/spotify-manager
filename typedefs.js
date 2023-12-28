/**
 * @typedef {import('module')} Module
 * 
 * @typedef {import('express').Request} Req
 * @typedef {import('express').Response} Res
 * @typedef {import('express').NextFunction} Next
 * 
 * @typedef {import('winston').Logger} Logger
 * 
 * @typedef {import('neo4j-driver').Session} Neo4jSession
 * 
 * @typedef {{
 * display_name: string,
 * uri: string,
 * id: string
 * }} PlaylistOwner
 * 
 * @typedef {{
 * name: string,
 * description: string,
 * owner: PlaylistOwner,
 * id: string,
 * }} SimplifiedPlaylist
 * 
 * @typedef	{{
 * name: string
 * }} Album
 * 
 * @typedef	{{
 * name: string
 * }} Artist
 * 
 * @typedef {{
 * uri: string,
 * name: string,
 * artists: Artist[]
 * album: Album,
 * is_local: boolean,
 * }} Track
 * 
 * @typedef {{
 * added_at: string,
 * track: Track,
 * }} PlaylistTrack
 * 
 * @typedef {{
 * uri: string,
 * name: string,
 * description: string,
 * owner: PlaylistOwner,
 * followers: {
 * 	total: number
 * },
 * tracks: PlaylistTrack[],
 * }} Playlist
 */

exports.unused = {};