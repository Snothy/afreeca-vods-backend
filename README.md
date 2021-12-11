# afreeca-vods-backend
API for afreeca vods

6. future plans
 - currently designed around one user with wonky authorization. in a future update the 'favourite streamers' should be tied to a specific user through a reference.
removing the streamer should only remove them for that user & the already added streamers will persist in the db until all users have removed them.
 - (frontend) upon launching the app with no login, assign the user a cookie. - afreeca assigns a cookie to everyone. 