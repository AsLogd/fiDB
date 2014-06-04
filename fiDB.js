//fiDB.js V0.1
//Some functions to make the IndexedDB API a little bit more friendly
//@author Gerard del castillo 

//Conf
//verbose (true|false) If true prints info to the console
//dbName (String) Database name
//version (long long) Version number 
//initStores (Array[{
//        name: (String), 
//        (Optional)storeParams: object,
//        (Optional)storeIndexes: Array[{
//              name: (String), 
//              keyPath: (String), 
//              (Optional)parameters: IDBIndexParameters}]
//    ]) Array of objects representing storeObjects
//initSuccess {Function} Callback function executed when init succeeded

window.iDB = function(conf){
  this.db = null;
  this.conf = conf;
  if("indexedDB" in window)
  {
    this.open()
    
  }
};

iDB.prototype = {
  _wrapper_: function(cb, params, msg){
        var self = this;
    
        //Ugly. Please someone fix me
        setTimeout(function(){
          if(cb)
            cb(params);

            if(self.conf.verbose)
            {
              console.log(msg);
            } 
          
        },1);
  },
  _const_: {
    READ_ONLY: 'readonly',
    READ_WRITE: 'readwrite'
  },
  /** Open
   * Uses conf object to create an IndexedDB and its objectStores.
   * Executes initComplete callback if provided
   */
    open: function(){
      var self = this,
          req = window.indexedDB.open(this.conf.dbName, this.conf.version ? this.conf.version : 1);
      
      req.onerror = function(e){
        if(self.conf.verbose) console.log("Couldn't open the database. ("+e.target.errorCode+")");
      };

      req.onsuccess = function(e){
        if(self.conf.verbose) console.log("Database opened. ("+self.conf.dbName+", "+self.conf.version+")");
        self.db = this.result;
        if(self.conf.initSuccess)
          self.conf.initSuccess();
      };

      req.onupgradeneeded = function(e){
        var dbRes = e.target.result;
        if(self.conf.initStores)
        {
          try
          {
            for(var i = 0; i < self.conf.initStores.length; i++)
            {
              var s = self.conf.initStores[i],
                  oStore = dbRes.createObjectStore(
                    s.name,
                    s.storeParams ? s.storeParams : {}
                  );

              if(s.storeIndexes)
              {
                for(var j= 0; j < s.storesIndexes.length; j++)
                {
                  oStore.createIndex(
                    s.storesIndexes.name,
                    s.storesIndexes.keyPath,
                    s.storesIndexes.parameters
                  );
                }
              }
            }

          }
          catch(e){
            if(self.conf.verbose) console.log("Error creating store objects. ("+e.message+")");
          }
        }
      };
    },
  
    /** Add
     * Stores a value in a objectStore.
     * If no keyPath or key generator was 
     * provided on conf.initStores.storeParams,
     * an out-of-line key is needed.
     *
     * @param String storeName 
     * @param Any value 
     * @param int|String key (Optional in some cases) 
     */
    add: function(storeName, value, key, cb_success, cb_error){
        var trans = this.db.transaction([storeName], this._const_.READ_WRITE),
            so = trans.objectStore(storeName),
            req = (key ? so.add(value, key) : so.add(value)),
            self = this;
      
      
        req.onsuccess =function(){
          self._wrapper_(cb_success, "", "Value stored.");
        }; 
      
        req.onerror = function(e){
           var err = e.target.errorCode
           self._wrapper_(cb_error, err, "Couldn't store the value. ("+err+")" ); 
        }

      
        
    },
    
      /** Put
       * Similar to add, but updates the value if
       * the key is in use
       * 
       * @param String storeName 
       * @param Any value 
       * @param int|String key (null for generated keys)
       */
    put: function(storeName, value, key, cb_success, cb_error){
      var trans = this.db.transaction([storeName], this._const_.READ_WRITE),
            so = trans.objectStore(storeName),
            req = (key ? so.put(value, key) : so.put(value)),
            self = this;
      
      
      req.onsuccess =function(){
        self._wrapper_(cb_success, "", "Value updated.");
      }; 
      req.onerror = function(e){
        var err = e.target.errorCode;
          self._wrapper_(cb_error, err, "Couldn't update the value. ("+err+")" );
      };
    },

    /** Get
     * Gets a single value from an object store with specific key
     *
     * @param String storeName
     * @param String|int key
     * @param Function cb_success
     * @param Function cb_error
     */
    get: function(storeName, key, cb_success, cb_error){
      var trans = this.db.transaction([storeName], this._const_.READ_ONLY),
            so = trans.objectStore(storeName),
            req = so.get(key),
            self = this;
      
      req.onsuccess =function(){
        self._wrapper_(cb_success, req.result, req.result);
      }; 

      req.onerror = function(e){
        var err = e.target.errorCode;
          self._wrapper_(cb_error, err, "Couldn't get the value. ("+err+")" );
      };
    },
    
    del: function(storeName, key, cb_success, cb_error){
      var trans = this.db.transaction([storeName], this._const_.READ_WRITE),
          so = trans.objectStore(storeName),
          req = so.delete(key),
          self = this;
      
      req.onsuccess =function(){
        self._wrapper_(cb_success, "", "Value deleted.");
      }; 

      req.onerror = function(e){
        var err = e.target.errorCode;
          self._wrapper_(cb_error, err, "Couldn't delete the value. ("+err+")" );
      };
    },

    /** Get All
     * Gets all the values from a store
     *
     * @param String storeName
     * @param Function cb_success
     * @param Function cb_error
     */
    getAll: function(storeName, cb_success, cb_error){
      var trans = this.db.transaction([storeName], this._const_.READ_ONLY),
          so = trans.objectStore(storeName),
          items = [],
          self = this;
      
      trans.oncomplete = function(){
        self._wrapper_(cb_success, items, items)
      };
      
      
      var cursorReq = so.openCursor();
      cursorReq.onerror = function(e){
        var err = e.target.errorCode;
        self._wrapper_(cb_error, err, "Couldn't get the values. ("+err+")");
      };
      
      cursorReq.onsuccess = function(e){
        var cursor = e.target.result;
        
        if(cursor)
        {
          items.push(cursor.value);
          cursor.continue();
        }
        
      };
    },
      putAll: function(storeName, values, startKey, cb_success, cb_error){

        
        var transaction = this.db.transaction(storeName, this._const_.READ_WRITE),
            so = transaction.objectStore(storeName),
            i = 0,
            self = this;

        putNext();

        function putNext(){
          if(i < values.length)
          {
            
            var req = so.put(values[i], i+startKey);
            i++;
            req.onsuccess = putNext;
            
            req.onerror = function(e){
              var err = e.target.errorCode;
              self._wrapper_(cb_error, err, "Couldn't get the values. ("+err+")");
            };
          }
          else
          {
             self._wrapper_(cb_success, "", "Values stored.");
          }
        }
      },
        
      clearStore: function(storeName, cb_success, cb_error){
          var trans = this.db.transaction(storeName, this._const_.READ_WRITE),
              so = trans.objectStore(storeName),
            self = this;
          
          var req = so.clear();
        
          req.onsuccess =function(){
            self._wrapper_(cb_success, req.result, "Store clear.");
          }; 

          req.onerror = function(e){
            var err = e.target.errorCode;
              self._wrapper_(cb_error, err, "Couldn't clear the store. ("+err+")" );
          };

      },
      resetAutoIndex: function(storeName, cb_success, cb_error){
        var self = this;
          this.getAll(storeName,function(items){
            self.clearStore(storeName, function(){
              self.putAll(storeName, items, 1, function(){
                self._wrapper_(cb_success, "", "Index reset.");
              });
            });
          });
      }

}; 
