/**
 * @typedef {import('module')} Module
 * 
 * @typedef {import('express').Request} Req
 * @typedef {import('express').Response} Res
 * @typedef {import('express').NextFunction} Next
 * 
 * @typedef {import("sequelize").Sequelize} Sequelize
 * @typedef {import("sequelize").Model} Model
 * @typedef {import("sequelize").QueryInterface} QueryInterface
 * 
 * @typedef {import('winston').Logger} Logger
 * 
 * @typedef {{
 * type: string,
 * is_local: boolean,
 * id: string,
 * artist?: string,
 * album?: string,
 * title?: string,
 * duration?: number
 * }} URIObject
 * 
 * @typedef {{
 * username: string,
 * uri: string
 * }} User
 * 
 * @typedef {{
 * name: string,
 * uri: string,
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
 * url: string,
 * height: number,
 * width: number
 * }} ImageObject
 * 
 * @typedef {{
 * uri: string,
 * name: string,
 * description: string,
 * collaborative: boolean,
 * public: boolean,
 * owner: User,
 * images: ImageObject[],
 * tracks: PlaylistTrack[],
 * }} PlaylistDetails
 */

exports.unused = {};