# HSO Backend

## Setting up and running

Get the code from github

```
git clone https://github.com/habitlab/habitlab-website.git
cd habitlab-website
```

Create the file `.getsecret.yaml` (in the `habitlab-website` directory) and add in the following contents:

```
MONGODB_URI: mongodb://localhost:27017/default
roles: viewdata,logging,reportbug,intervention,debug
```

Install [Node.js](https://nodejs.org/en/) version 8, [MongoDB](https://docs.mongodb.com/manual/administration/install-community/) version 3.4.

Install dependencies:

```
yarn
sudo npm install -g mongosrv node-dev
```

## Syncing the Database

Update .getsecret.yaml with the credentials to the database you wish to sync as MONGODB_SRC and the destination as MONGODB_DST. If you are syncing to the local database, then MONGODB_DST should be `MONGODB_DST: mongodb://localhost:27017/test` and you should start the database with the command

```
mongosrv
```

To sync the contents over, run the scripts

```
./scripts/copy_database --fresh --threads 20
```

Once the database finishes syncing, keep the command mongosrv running (it will take a while, ie 20+ minutes, to start again. You will know the mongodb server has finished starting up when you see a message "Listening on port 27017" is displayed). Then run the command

```
./runserver
```

To start the server.

## Extracting the Database (old, ignore)

Extract the file `mongodb_backup_nov9.tar.gz` to a directory.

Go to the directory where you want the database to be stored. Run the command:

```
mongosrv
```

A folder called `mongodata` will be created containing the database.

Now run the following command to restore the database from the dump:

```
mongorestore mongodb_backup_nov9/dump
```

On subsequent runs, you just need to start the command `mongosrv` in that folder containing the `mongodata` command to start the server.

## Running the server

Make sure the mongodb server is running (using the `mongosrv` command, see section above), then run the following command from the `habitlab-website` directory:

```
./runserver
```

## Accessing the dashboard

Once the server is running, visit http://localhost:5000/dashboard to see the dashboard. The UI code for the dashboard is under [www/dashboard.html](https://github.com/habitlab/habitlab-website/blob/master/www/dashboard.html) and the data analysis logic is defined as functions in [www/libfrontend.js](https://github.com/habitlab/habitlab-website/blob/master/www/libfrontend.js). To run the javascript functions interactively open the developer console using Ctrl-Shift-J.

The routes for the server are defined under files in [routes/viewdata_routes.ls](https://github.com/habitlab/habitlab-website/blob/master/routes/viewdata_routes.ls) - to use them either visit the corresponding route in the web browser - ie http://localhost:5000/get_users_with_logs_who_are_no_longer_active  - or visit `chrome://inspect` and click the `inspect` button while the server is running and call the function - ie, `get_users_with_logs_who_are_no_longer_active().then(x => console.log(x))`
