
//var fs = require("fs")
let get_store_cached = {}

async function record_that_store_exists(name) {
  let store = localforage.createInstance({name: 'store_list'})
  await store.setItem(name, true)
}

function get_store(name) {
  if (get_store_cached[name]) {
    return get_store_cached[name]
  }
  let store = localforage.createInstance({name: name})
  get_store_cached[name] = store
  record_that_store_exists(name)
  return store
}

async function clear_caches() {
  console.log('clear_caches called')
  let store = localforage.createInstance({name: 'store_list'})
  console.log('clear_caches store created')
  let keys = await store.keys()
  console.log('clear_caches keys are')
  console.log(keys)
  for (let key of keys) {
    console.log(key)
    let substore = localforage.createInstance({name: key})
    await substore.clear()
    console.log('store cleared: ' + key)
    indexedDB.deleteDatabase(key)
    console.log('database cleared: ' + key)
  }
  await store.clear()
  //indexedDB.deleteDatabase('store_list')
  for (let key of Object.keys(get_store_cached)) {
    delete get_store_cached[key]
  }
  console.log('clear_caches done')
}

async function clear_cache_for_func(name) {
  let store = get_store('memoizedisk|' + name)
  await store.clear()
}

async function get_plots_div() {
  let num_checks_for_basetag = 0
  while (window.basetag == null) {
    await sleep(100)
    num_checks_for_basetag += 1
    if (num_checks_for_basetag > 100) {
      console.log('get_plots_div taking a long time to get window.basetag, check that this is a polymer component')
    }
  }
  let plots_div = window.basetag.$$('#plots')
  if (plots_div == null) {
    console.log('#plots id missing in element')
  }
  return plots_div
}

async function plot_data(data, title, layout) {
  if (title == null) {
    title = 'untitled plot'
  }
  let h = $(await get_plots_div())
  h.append($('<div>').text(title))
  let newdiv = document.createElement('div')
  h.append(newdiv)
  Plotly.newPlot(newdiv, data, layout)
}

function plot_trace (trace, title) {
  plot_data([trace], title)
}

function plot_bar(trace, title) {
  trace = JSON.parse(JSON.stringify(trace))
  trace.type = 'bar'
  plot_trace(trace, title)
}

function plot_series(series, title) {
  let trace = {
    x: math.range(0, series.length).toArray(),
    y: series,
  }
  plot_bar(trace)
}

function plot_histogram(values, title) {
  let trace = {
    x: values,
    type: 'histogram',
    histnorm: 'probability density',
  }
  plot_trace(trace, title)
}

function plot_histogram_pair(values1, values2, title) {
  let trace1 = {
    x: values1,
    type: 'histogram',
    nbinsy: '10',
    histnorm: 'probability density',
    opacity: 0.5,
    marker: {
      color: 'green'
    }
  }
  let trace2 = {
    x: values2,
    type: 'histogram',
    nbinsy: '10',
    histnorm: 'probability density',
    opacity: 0.5,
    marker: {
      color: 'red'
    }
  }
  let layout = {
    barmode: 'overlay'
  }
  plot_data([trace1, trace2], title, layout)
}

async function printstats_ind(random_durations, same_durations, msg) {
  if (msg != null) {
    console.log('======== ' + msg + ' =========')
  }
  console.log('num samples random')
  console.log(random_durations.length)
  console.log('num samples same')
  console.log(same_durations.length)
  console.log('mean random')
  console.log(prelude.mean(random_durations))
  console.log('mean same')
  console.log(prelude.mean(same_durations))
  console.log('median random')
  console.log(median(random_durations))
  console.log('median same')
  console.log(median(same_durations))
  console.log('stddev random')
  console.log(math.std(random_durations))
  console.log('stddev same')
  console.log(math.std(same_durations))
  console.log('mannwhitneyu')
  console.log(await pyfunc('mannwhitneyu', same_durations, random_durations))
  console.log('ttest_ind')
  console.log(await pyfunc('ttest_ind', same_durations, random_durations))
}

async function printstats_ind_with_log(random_durations, same_durations, msg) {
  await printstats_ind(random_durations, same_durations, msg)
  await printstats_ind(random_durations.map(Math.log), same_durations.map(Math.log), msg + ' (log)')
}

async function printstats_rel(random_durations, same_durations, msg) {
  await printstats_ind(random_durations, same_durations, msg)
  if (random_durations.length != same_durations.length) {
    console.log('need to pass collections of equal length to printstats_rel')
    return
  }
  console.log('wilcoxon')
  console.log(await pyfunc('wilcoxon', same_durations, random_durations))
  console.log('ttest_rel')
  console.log(await pyfunc('ttest_rel', same_durations, random_durations))
}

async function printstats_rel_with_log(random_durations, same_durations, msg) {
  await printstats_rel(random_durations, same_durations, msg)
  await printstats_rel(random_durations.map(Math.log), same_durations.map(Math.log), msg + ' (log)')
}

function memoize_to_disk(f, func_name) {
  if (func_name == null) {
    func_name = f.name
  }
  if (func_name == null || func_name == 'anonymous') {
    throw new Exception('need to supply func name')
  }
  if (f.length == 1) {
    return memoize_to_disk_1arg(f, func_name)
  }
  if (f.length == 0) {
    return memoize_to_disk_0arg(f, func_name)
  }
  throw new Exception('memoize_to_disk provided with function with inappropriate number of arguments: ' + f.name + ' with num arguments ' + f.length)
}

function memoize_to_disk_nargs(f, func_name, num_args) {
  if (typeof(func_name) == 'number') {
    num_args = func_name
    func_name = f.name
  }
  if (func_name == null || func_name == 'anonymous') {
    throw new Exception('need to supply func name')
  }
  if (num_args == 0) {
    return memoize_to_disk_0arg(f, func_name)
  } else if (num_args == 1) {
    return memoize_to_disk_1arg(f, func_name)
  } else {
    alert('memoize_to_disk_nargs called for function ' + func_name + ' with unsupported num_args ' + num_args)
  }
}

function memoize_to_disk_0arg(f, func_name) {
  if (func_name == null) {
    func_name = f.name
  }
  if (func_name == null || func_name == 'anonymous') {
    throw new Exception('need to supply func name')
  }
  let store = get_store('memoizedisk|' + func_name)
  let memoize_to_disk_0arg_cache = null
  return async function() {
    if (memoize_to_disk_0arg_cache != null) {
      return memoize_to_disk_0arg_cache
    }
    let cached_value = await store.getItem('default')
    if (cached_value != null) {
      return cached_value
    }
    cached_value = await f()
    if (cached_value != null) {
      await store.setItem('default', cached_value)
    }
    memoize_to_disk_0arg_cache = cached_value
    return cached_value
  }
}

function memoize_to_disk_1arg(f, func_name) {
  if (func_name == null) {
    func_name = f.name
  }
  if (func_name == null || func_name == 'anonymous') {
    throw new Exception('need to supply func name')
  }
  let memoize_to_disk_1arg_cache = {}
  let store = get_store('memoizedisk|' + func_name)
  return async function(arg) {
    if (memoize_to_disk_1arg_cache[arg] != null) {
      return memoize_to_disk_1arg_cache[arg]
    }
    let cached_value = await store.getItem(arg)
    if (cached_value != null) {
      return cached_value
    }
    cached_value = await f(arg)
    if (cached_value != null) {
      await store.setItem(arg, cached_value)
    }
    return cached_value
  }
}

function memoize_to_disk_2arg(f, func_name) {
  if (func_name == null) {
    func_name = f.name
  }
  if (func_name == null || func_name == 'anonymous') {
    throw new Exception('need to supply func name')
  }
  let memoize_to_disk_2arg_cache = {}
  let store = get_store('memoizedisk|' + func_name)
  return async function(arg, arg2) {
    if (memoize_to_disk_2arg_cache[arg] != null && memoize_to_disk_2arg_cache[arg][arg2] != null) {
      return memoize_to_disk_2arg_cache[arg][arg2]
    }
    let cached_value = await store.getItem(arg + '|' + arg2)
    if (cached_value != null) {
      return cached_value
    }
    cached_value = await f(arg, arg2)
    if (cached_value != null) {
      await store.setItem(arg + '|' + arg2, cached_value)
    }
    return cached_value
  }
}

async function sleep(time) {
  return new Promise(function(it) {
    return setTimeout(it, time)
  })
}

async function pyfunc(funcname, ...args) {
  //return await fetch('http://localhost:9999/' + funcname + '?' + $.param({args: JSON.stringify(args)}))
  //console.log(args)
  //console.log('args=' + JSON.stringify(args))
  return await $.ajax({
    //url: 'http://localhost:9999/' + funcname + '?'  + $.param({'args': args}),
    url: 'http://localhost:9999/' + funcname + '?args=' + JSON.stringify(args),
    jsonp: 'callback',
    dataType: 'jsonp'
  })
  //return await $.getJSON('http://localhost:9999/' + funcname + '?args='  + JSON.stringify(args) + '&callback=?')
  /*
  await $.ajax({
    url: 'http://localhost:9999/' + funcname + '?'  + $.param({'args': args}),
    jsonp: 'callback',
    dataType: 'jsonp'
  })
  */
}

async function geolocate_ip(ip_addr) {
  let geolocate_info = {}
  if (localStorage.getItem('geolocate_info_' + ip_addr)) {
    geolocate_info = JSON.parse(localStorage.getItem('geolocate_info_' + ip_addr))
  } else {
    geolocate_info = await $.ajax({
      url: 'http://ip-api.com/json/' + ip_addr,
      jsonp: 'callback',
      dataType: 'jsonp'
    })
    localStorage.setItem('geolocate_info_' + ip_addr, JSON.stringify(geolocate_info))
  }
  return geolocate_info
}

function display_dictionary_as_table(dict, selector) {
  let keys_and_values = []
  for (let key of Object.keys(dict)) {
    let value = dict[key]
    keys_and_values.push([key, value])
  }
  keys_and_values.sort(function(a, b) {
    return a[1] - b[1]
  })
  keys_and_values.reverse()
  for (let [key,val] of keys_and_values) {
    $(selector).append($('<div>').text(key + ': ' + val))
  }
}

function display_list_as_table(list, selector) {
  target = $(selector)
  for (let item of list) {
    target.append($('<div>').text(JSON.stringify(item)))
  }
}

function dict_to_sorted(language_to_num_installs) {
  let language_and_num_installs = []
  for (let language of Object.keys(language_to_num_installs)) {
    let num_installs = language_to_num_installs[language]
    language_and_num_installs.push([language, num_installs])
  }
  language_and_num_installs.sort((a, b) => a[1] - b[1]).reverse()
  return language_and_num_installs
}

function dict_to_array_sorted_zeros(install_duration_to_num_users) {
  let max_value = prelude.maximum(Object.keys(install_duration_to_num_users).map(x => parseInt(x)))
  let output = new Array(max_value + 1).fill(0)
  for (let i = 0; i <= max_value; ++i) {
    if (install_duration_to_num_users[(i).toString()] == null) {
      output[i] = [(i).toString(), 0]
    } else {
      output[i] = [(i).toString(), install_duration_to_num_users[i]]
    }
  }
  return output
}

async function getjson(path, data) {
  if (typeof(data) != 'object') {
    data = {}
  }
  let querystring = ''
  let is_first = true
  for (let key of Object.keys(data)) {
    if (is_first) {
      is_first = false
      querystring += '?' + key + '=' + data[key]
    } else {
      querystring += '&' + key + '=' + data[key]
    }
  }
  return await fetch(path + querystring).then(x => x.json())
}

async function get_selection_algorithm_and_users_list() {
  let all_collections = await listcollections()
  let users_with_experiment_vars = []
  let selection_algorithm_and_users_list = []
  let selection_algorithm_to_idx = {}
  for (let collection_fullname of all_collections) {
    let underscore_index = collection_fullname.indexOf('_')
    let username = collection_fullname.substr(0, underscore_index)
    let collection_name = collection_fullname.substr(underscore_index + 1)
    if (collection_name == 'synced:experiment_vars') {
      users_with_experiment_vars.push(username)
    }
  }
  console.log("collection done")
  console.log(users_with_experiment_vars)
  for (let userid of users_with_experiment_vars) {
    let experiment_vars_list = await get_collection_for_user_cached(userid, 'synced:experiment_vars')
    for (let x of experiment_vars_list) {
      if (x.key == 'selection_algorithm_for_visit') {
        if (selection_algorithm_to_idx[x.val] == null) {
          selection_algorithm_to_idx[x.val] = selection_algorithm_and_users_list.length
          selection_algorithm_and_users_list.push({
            algorithm: x.val,
            users: [],
          })
        }
        selection_algorithm_and_users_list[selection_algorithm_to_idx[x.val]].users.push(userid)
      }
    }
  }
  return selection_algorithm_and_users_list
}

async function get_selection_algorithm_and_install_ids_list() {
  let all_collections = await listcollections()
  let users_with_experiment_vars = []
  let selection_algorithm_and_users_list = []
  let selection_algorithm_to_idx = {}
  for (let collection_fullname of all_collections) {
    let underscore_index = collection_fullname.indexOf('_')
    let username = collection_fullname.substr(0, underscore_index)
    let collection_name = collection_fullname.substr(underscore_index + 1)
    if (collection_name == 'synced:experiment_vars') {
      users_with_experiment_vars.push(username)
    }
  }
  for (let userid of users_with_experiment_vars) {
    let experiment_vars_list = await get_collection_for_user_cached(userid, 'synced:experiment_vars')
    for (let x of experiment_vars_list) {
      if (x.key == 'selection_algorithm_for_visit') {
        let install_id = x.install_id
        if (selection_algorithm_to_idx[x.val] == null) {
          selection_algorithm_to_idx[x.val] = selection_algorithm_and_users_list.length
          selection_algorithm_and_users_list.push({
            algorithm: x.val,
            install_ids: [],
          })
        }
        selection_algorithm_and_users_list[selection_algorithm_to_idx[x.val]].install_ids.push(install_id)
      }
    }
  }
  return selection_algorithm_and_users_list
}

async function get_selection_algorithm_to_users_list() {
  let output = {}
  let selection_algorithm_and_users_list = await get_selection_algorithm_and_users_list()
  for (let {algorithm, users} of selection_algorithm_and_users_list) {
    output[algorithm] = users
  }
  return output
}

let get_selection_algorithm_to_users_list_cached = memoize_to_disk_0arg(get_selection_algorithm_to_users_list, 'get_selection_algorithm_to_users_list')

async function get_all_users_with_experiment_vars() {
  let users_with_experiment_vars = []
  let users_with_experiment_vars_set = {}
  let all_collections = await listcollections()
  for (let collection_fullname of all_collections) {
    let underscore_index = collection_fullname.indexOf('_')
    let username = collection_fullname.substr(0, underscore_index)
    if (users_with_experiment_vars[username] != null) {
      continue
    }
    let collection_name = collection_fullname.substr(underscore_index + 1)
    if (collection_name == 'synced:experiment_vars') {
      users_with_experiment_vars.push(username)
    }
  }
  return users_with_experiment_vars
}

let get_all_users_with_experiment_vars_cached = memoize_to_disk_0arg(get_all_users_with_experiment_vars, 'get_all_users_with_experiment_vars')

async function get_all_users_in_experiment_by_name(experiment_name) {
  let output = []
  let output_set = {}
  let users_with_experiment_vars = await get_all_users_with_experiment_vars_cached()
  for (let userid of users_with_experiment_vars) {
    let experiment_vars_list = await get_collection_for_user_cached(userid, 'synced:experiment_vars')
    for (let x of experiment_vars_list) {
      if (x.key == experiment_name) {
        if (output_set[userid] == null) {
          output_set[userid] = true
          output.push(userid)
        }
      }
    }
  }
  return output
}

async function get_all_users_in_experiment_by_name_and_value(experiment_name, val) {
  let output = []
  let output_set = {}
  let users_with_experiment_vars = await get_all_users_with_experiment_vars_cached()
  for (let userid of users_with_experiment_vars) {
    let experiment_vars_list = await get_collection_for_user_cached(userid, 'synced:experiment_vars')
    for (let x of experiment_vars_list) {
      if (x.key == experiment_name && x.val == val) {
        if (output_set[userid] == null) {
          output_set[userid] = true
          output.push(userid)
        }
      }
    }
  }
  return output
}

async function get_users_to_conditions_in_experiment_by_name(experiment_name) {
  let output = {}
  let users_with_experiment_vars = await get_all_users_with_experiment_vars_cached()
  for (let userid of users_with_experiment_vars) {
    let experiment_vars_list = await get_collection_for_user_cached(userid, 'synced:experiment_vars')
    for (let x of experiment_vars_list) {
      if (x.key == experiment_name) {
        output[userid] = x.val
      }
    }
  }
  return output
}

async function get_users_chosen_difficulty() {
  let output = {}
  let users_with_experiment_vars = await get_all_users_with_experiment_vars_cached()
  for (let userid of users_with_experiment_vars) {
    let experiment_vars_list = await get_collection_for_user_cached(userid, 'synced:experiment_vars')
    for (let x of experiment_vars_list) {
      if (x.key == 'user_chosen_difficulty_survey') {
        output[userid] = x.val
      }
    }
  }
  return output
} 

async function get_users_difficulty_seen() {
  let output = await get_user_to_difficulty()
  let selection_screen = await get_users_to_conditions_in_experiment_by_name('difficulty_selection_screen')
  let users_with_experiment_vars = await get_all_users_with_experiment_vars_cached()
  let output2 = await get_users_chosen_difficulty()
  for (let userid of Object.keys(output)) {
    if (!selection_screen[userid])
      continue
    let strs = selection_screen[userid].split('_')
    if (strs[0] == 'survey') 
      output[userid] = output2[userid]
  }
  return output
}

async function get_user_to_difficulty() {
  let infolist = await get_collection_cached('features:difficuty') // yes typo was made whoops
  let output = {}
  for (let x of infolist) {
    if (x.feature != 'difficuty') {
      continue
    }
    let userid = x.user_id
    let install_id = x.install_id
    let difficulty = x.difficulty
    output[userid] = difficulty
  }
  return output
}

async function get_all_users_in_firstimpression_experiment() {
  let output = []
  let output_set = {}
  let users_with_experiment_vars = await get_all_users_with_experiment_vars_cached()
  for (let userid of users_with_experiment_vars) {
    let experiment_vars_list = await get_collection_for_user_cached(userid, 'synced:experiment_vars')
    for (let x of experiment_vars_list) {
      if (x.key == 'intervention_firstimpression_notice') {
        if (output_set[userid] == null) {
          output_set[userid] = true
          output.push(userid)
        }
      }
    }
  }
  return output
}

let get_all_users_in_firstimpression_experiment_cached = memoize_to_disk_0arg(get_all_users_in_firstimpression_experiment, 'get_all_users_in_firstimpression_experiment')

async function get_all_install_ids_in_firstimpression_experiment() {
  let output = []
  let output_set = {}
  let users_with_experiment_vars = await get_all_users_with_experiment_vars_cached()
  for (let userid of users_with_experiment_vars) {
    let experiment_vars_list = await get_collection_for_user_cached(userid, 'synced:experiment_vars')
    for (let x of experiment_vars_list) {
      let install_id = x.install_id
      if (x.key == 'intervention_firstimpression_notice') {
        if (output_set[install_id] == null) {
          output_set[install_id] = true
          output.push(install_id)
        }
      }
    }
  }
  return output
}

let get_all_install_ids_in_firstimpression_experiment_cached = memoize_to_disk_0arg(get_all_install_ids_in_firstimpression_experiment, 'get_all_install_ids_in_firstimpression_experiment')

async function get_last_onboarding_slide_idx_for_user(userid) {
  let output = -1
  let page_logs = await get_collection_for_user_cached(userid, 'logs:pages')
  for (let x of page_logs) {
    if (x.tab != 'onboarding') {
      continue
    }
    let slide_idx = x.slide_idx
    if (!isFinite(slide_idx)) {
      continue
    }
    output = Math.max(slide_idx, output)
  }
  return output
}

let get_last_onboarding_slide_idx_for_user_cached = memoize_to_disk_1arg(get_last_onboarding_slide_idx_for_user, 'get_last_onboarding_slide_idx_for_user')

async function get_selection_algorithm_to_install_ids_list() {
  let output = {}
  let selection_algorithm_and_users_list = await get_selection_algorithm_and_install_ids_list()
  for (let {algorithm, install_ids} of selection_algorithm_and_users_list) {
    output[algorithm] = install_ids
  }
  return output
}

let get_selection_algorithm_to_install_ids_list_cached = memoize_to_disk_0arg(get_selection_algorithm_to_install_ids_list, 'get_selection_algorithm_to_install_ids_list')

async function get_install_id_to_user_id() {
  let user_to_all_install_ids = await get_user_to_all_install_ids_cached()
  let output = {}
  for (let userid of Object.keys(user_to_all_install_ids)) {
    let install_ids = user_to_all_install_ids[userid]
    for (let install_id of install_ids) {
      if (install_id == null) {
        continue
      }
      output[install_id] = userid
    }
  }
  return output
}

let get_install_id_to_user_id_cached = memoize_to_disk_0arg(get_install_id_to_user_id, 'get_install_id_to_user_id')

async function get_userid_to_all_install_ids(userid) {
  let user_to_all_install_ids = await get_user_to_all_install_ids_cached()
  return user_to_all_install_ids[userid]
}

async function get_userid_from_install_id(install_id) {
  let install_id_to_user_id = await get_install_id_to_user_id_cached()
  return install_id_to_user_id[install_id]
}

async function get_user_to_install_times_list() {
  let install_info_list = await get_installs()
  let output = {}
  for (let install_info of install_info_list) {
    let user_id = install_info.user_id
    if (output[user_id] == null) {
      output[user_id] = []
    }
    if (install_info.timestamp == null) {
      console.log('missing timestamp for user install event for user_id ' + user_id)
      continue
    }
    output[user_id].push(install_info.timestamp)
  }
  for (let user_id of Object.keys(output)) {
    output[user_id].sort((a, b) => a - b)
  }
  return output
}

async function get_domain_visit_info_for_user_compressed(userid) {
  let history_vars_collection = await get_collection_for_user_cached(userid, 'synced:history_vars')
  for (let x of history_vars_collection) {
    if (x.key != 'domain_visit_info') {
      continue
    }
    return x.val
  }
  return ''
}

async function get_domain_visit_info_for_user(userid) {
  let data_compressed = await get_domain_visit_info_for_user_compressed(userid)
  if (data_compressed == null || data_compressed == '') {
    return {}
  }
  return JSON.parse(LZString.decompressFromEncodedURIComponent(x.val))
}

async function get_domain_to_num_visits_for_user(userid) {
  let data = await get_domain_visit_info_for_user(userid)
  // domain -> [num unique urls, num unique urls typed, total visits, total typed, first visit time, last visit time]
  let output = {}
  for (let domain of Object.keys(data)) {
    let info = data[domain]
    output[domain] = info[2]
  }
  return output
}

async function get_user_to_install_times_list_cached() {
  let install_info_list = await get_installs_cached()
  let output = {}
  for (let install_info of install_info_list) {
    let user_id = install_info.user_id
    if (output[user_id] == null) {
      output[user_id] = []
    }
    if (install_info.timestamp == null) {
      console.log('missing timestamp for user install event for user_id ' + user_id)
      continue
    }
    output[user_id].push(install_info.timestamp)
  }
  for (let user_id of Object.keys(output)) {
    output[user_id].sort((a, b) => a - b)
  }
  return output
}

async function get_user_to_install_dates_list() {
  let install_info_list = await get_installs()
  let output = {}
  for (let install_info of install_info_list) {
    let user_id = install_info.user_id
    if (output[user_id] == null) {
      output[user_id] = []
    }
    if (install_info.timestamp == null) {
      console.log('missing timestamp for user install event for user_id ' + user_id)
      continue
    }
    output[user_id].push(moment(install_info.timestamp).tz("America/Los_Angeles").format('YYYYMMDD'))
  }
  for (let user_id of Object.keys(output)) {
    output[user_id].sort()
  }
  return output
}

async function get_user_to_install_dates_list_cached() {
  let install_info_list = await get_installs_cached()
  let output = {}
  for (let install_info of install_info_list) {
    let user_id = install_info.user_id
    if (output[user_id] == null) {
      output[user_id] = []
    }
    if (install_info.timestamp == null) {
      console.log('missing timestamp for user install event for user_id ' + user_id)
      continue
    }
    output[user_id].push(moment(install_info.timestamp).tz("America/Los_Angeles").format('YYYYMMDD'))
  }
  for (let user_id of Object.keys(output)) {
    output[user_id].sort()
  }
  return output
}

async function get_user_to_uninstall_times_list() {
  let install_info_list = await get_uninstalls()
  let output = {}
  for (let install_info of install_info_list) {
    let user_id = install_info.u
    if (output[user_id] == null) {
      output[user_id] = []
    }
    if (install_info.timestamp == null) {
      console.log('missing timestamp for user install event for user_id ' + user_id)
      continue
    }
    output[user_id].push(install_info.timestamp)
  }
  for (let user_id of Object.keys(output)) {
    output[user_id].sort((a, b) => a - b)
  }
  return output
}

async function get_user_to_uninstall_times_list_cached() {
  let install_info_list = await get_uninstalls_cached()
  let output = {}
  for (let install_info of install_info_list) {
    let user_id = install_info.u
    if (output[user_id] == null) {
      output[user_id] = []
    }
    if (install_info.timestamp == null) {
      console.log('missing timestamp for user install event for user_id ' + user_id)
      continue
    }
    output[user_id].push(install_info.timestamp)
  }
  for (let user_id of Object.keys(output)) {
    output[user_id].sort((a, b) => a - b)
  }
  return output
}

async function get_user_to_uninstall_dates_list() {
  let install_info_list = await get_uninstalls()
  let output = {}
  for (let install_info of install_info_list) {
    let user_id = install_info.u
    if (output[user_id] == null) {
      output[user_id] = []
    }
    if (install_info.timestamp == null) {
      console.log('missing timestamp for user uninstall event for user_id ' + user_id)
      continue
    }
    output[user_id].push(moment(install_info.timestamp).tz("America/Los_Angeles").format('YYYYMMDD'))
  }
  for (let user_id of Object.keys(output)) {
    output[user_id].sort()
  }
  return output
}

async function get_user_to_uninstall_dates_list_cached() {
  let install_info_list = await get_uninstalls_cached()
  let output = {}
  for (let install_info of install_info_list) {
    let user_id = install_info.u
    if (output[user_id] == null) {
      output[user_id] = []
    }
    if (install_info.timestamp == null) {
      console.log('missing timestamp for user uninstall event for user_id ' + user_id)
      continue
    }
    output[user_id].push(moment(install_info.timestamp).tz("America/Los_Angeles").format('YYYYMMDD'))
  }
  for (let user_id of Object.keys(output)) {
    output[user_id].sort()
  }
  return output
}

async function get_user_to_install_data() {
  let install_info_list = await get_installs()
  let output = {}
  for (let install_info of install_info_list) {
    let user_id = install_info.user_id
    output[user_id] = install_info
  }
  return output
}

async function get_user_to_install_data_cached() {
  let install_info_list = await get_installs_cached()
  let output = {}
  for (let install_info of install_info_list) {
    let user_id = install_info.user_id
    output[user_id] = install_info
  }
  return output
}

async function get_install_id_to_is_official() {
  let install_info_list = await get_installs_cached()
  let output = {}
  for (let install_info of install_info_list) {
    let install_id = install_info.install_id
    if (install_id == null) {
      continue
    }
    let is_official = true
    if (output[install_info] == false) {
      continue
    }
    if (install_info.devmode || install_info.unofficial_version) {
      is_official = false
    }
    if (install_info.chrome_runtime_id != "obghclocpdgcekcognpkblghkedcpdgd") {
      is_official = false
    }
    output[install_id] = is_official
  }
  return output
}

async function get_timestamp_experiment_var_was_last_set_for_userid(userid, varname) {
  let output = -1
  let experiment_vars = await get_collection_for_user_cached(userid, 'synced:experiment_vars')
  for (let x of experiment_vars) {
    if (x.key == varname) {
      output = Math.max(output, x.timestamp)
    }
  }
  return output
}

async function get_timestamp_experiment_var_was_last_set_for_install_id(install_id, varname) {
  let output = -1
  let userid = await get_userid_from_install_id(install_id)
  let experiment_vars = await get_collection_for_user_cached(userid, 'synced:experiment_vars')
  for (let x of experiment_vars) {
    if (x.key == varname) {
      output = Math.max(output, x.timestamp)
    }
  }
  return output
}

async function get_user_to_is_official() {
  let install_info_list = await get_installs_cached()
  let output = {}
  for (let install_info of install_info_list) {
    let install_id = install_info.user_id
    if (install_id == null) {
      continue
    }
    let is_official = true
    if (output[install_info] == false) {
      continue
    }
    if (install_info.devmode || install_info.unofficial_version) {
      is_official = false
    }
    if (install_info.chrome_runtime_id != "obghclocpdgcekcognpkblghkedcpdgd") {
      is_official = false
    }
    output[install_id] = is_official
  }
  return output
}

async function get_unofficial_users() {

}

async function get_install_data() {
  let install_info_list = await get_installs()
  let output = []
   for (let install_info of install_info_list) {
    if (install_info.devmode || install_info.unofficial_version) {
      continue
    }
    if (!install_info.language || !install_info.languages) {
      continue
    }
    if (!install_info.install_source) {
      continue
    }
    output.push(install_info)
  }
  return output
}

async function get_uninstall_data() {
  let install_info_list = await get_uninstalls()
  let output = []
  for (let install_info of install_info_list) {
    if (install_info.r != 0) { // not stable release
      continue
    }
    //if (!install_info.language || !install_info.languages) {
    //  continue
    //}
    output.push(install_info)
  }
  return output
}

async function get_logging_states() {
  let logging_info_list = await getjson('/get_logging_states')
  return logging_info_list
}

/*
async function list_active_users() {
  let active_users_list = await getjson('/getactiveusers')
  return active_users_list
}
*/

async function list_active_users_week() {
  let active_users_list = await getjson('/getactiveusers_week')
  return active_users_list
}

async function list_intervention_logs(userid) {
  let collections_list = await list_logs_for_user(userid)
  let log_name_list = []
  for (let collection_name of collections_list) {
    let collection_name_short = collection_name.replace(userid + '_', '')
    log_name_list.push(collection_name_short)
  }
  let log_name_list_filtered = []
  let pattern = /^(synced|logs)/
  for (let log_name of log_name_list) {
    if (!log_name.match(pattern)) {
      log_name_list_filtered.push(log_name)
    }
  }
  return log_name_list_filtered
}

async function get_collection_for_user(userid, collection_name) {
  return await getjson('/printcollection', {userid: userid, logname: collection_name})
}

let get_collection_for_user_cached = memoize_to_disk_2arg(get_collection_for_user, 'get_collection_for_user')

async function get_collection(collection_name) {
  return await getjson('/printcollection', {collection: collection_name})
}

let get_collection_cached = memoize_to_disk_1arg(get_collection, 'get_collection')

async function get_intervention_logs_for_user(userid, intervention_name) {
  intervention_name = intervention_name.split('/').join(':')
  return await get_collection_for_user_cached(userid, intervention_name)
}

async function get_user_max_intervention_count(userid) {
  let intervention_count_dict = await get_intervention_count_dict(userid)
  // let curr = 0
  // intervention_count_dict.then(function(x) {
  //   for ([k, v] of x){
  //     if (v > curr) {
  //       curr = v
  //     }
  //   }
  // })
  console.log(intervention_count_dict)
}

async function get_intervention_count_dict(userid) {
  let combined_collection = await get_combined_collection_for_user(userid)
  let intervention_count_dict = {}
  for (let entry of combined_collection) {
    let intervention_name = entry["intervention"]
    if (intervention_count_dict[intervention_name] == null) {
      intervention_count_dict[intervention_name] = 0
    }
    intervention_count_dict[intervention_name] += 1
  }
}

async function get_combined_collection_for_user(userid) {
  let intervention_list = await list_intervention_logs(userid)
  let combined_collection = []
  for (let intervention_name of intervention_list) {
    let collection = await get_collection_for_user(userid, intervention_name)
    for (let x of collection) {
      combined_collection.push(x)
    }
  }
  return combined_collection
}

async function get_latest_goal_info_for_user(userid) {
  let goal_logs = await get_collection_for_user(userid, 'logs:goals')
  let latest_timestamp = 0
  let latest_log_info = {}
  for (let log_info of goal_logs) {
    let timestamp = log_info.timestamp
    if (timestamp > latest_timestamp) {
      latest_timestamp = timestamp
      latest_log_info = log_info
    }
  }
  return latest_log_info
}

async function get_latest_intervention_info_for_user(userid) {
  let intervention_logs = await get_collection_for_user(userid, 'logs:interventions')
  let latest_timestamp = 0
  let latest_log_info = {}
  for (let log_info of intervention_logs) {
    let timestamp = log_info.timestamp
    if (timestamp > latest_timestamp) {
      latest_timestamp = timestamp
      latest_log_info = log_info
    }
  }
  return latest_log_info
}

async function get_enabled_goals_for_user(userid) {
  let latest_log_info = await get_latest_goal_info_for_user(userid)
  let output = []
  if (latest_log_info.enabled_goals) {
    for (let goal_name of Object.keys(latest_log_info.enabled_goals)) {
      if (latest_log_info.enabled_goals[goal_name]) {
        output.push(goal_name)
      }
    }
  }
  output.sort()
  return output
}

async function get_goals_tried_by_user(userid) {
  let goal_targets_logs = await get_collection_for_user(userid, 'synced:goal_targets')
  let output_set = {}
  for (let goal_target_info of goal_targets_logs) {
    let goal_name = goal_target_info.key
    output_set[goal_name] = true
  }
  let output = Object.keys(output_set)
  output.sort()
  return output
}

async function get_goal_targets_for_user(userid) {
  let goal_targets_logs = await get_collection_for_user(userid, 'synced:goal_targets')
  let output = {}
  for (let goal_target_info of goal_targets_logs) {
    let goal_name = goal_target_info.key
    let goal_target = goal_target_info.val
    output[goal_name] = goal_target
  }
  return output
}

/*
async function get_enabled_interventions_for_user(userid) {
  let latest_log_info = await get_latest_goal_info_for_user(userid)
  let output = []
  if (latest_log_info.enabled_interventions) {
    for (let intervention_name of Object.keys(latest_log_info.enabled_interventions)) {
      if (latest_log_info.enabled_interventions[intervention_name]) {
        output.push(intervention_name)
      }
    }
  }
  output.sort()
  return output
}
*/

async function get_enabled_interventions_for_user(userid) {
  let latest_log_info = await get_latest_intervention_info_for_user(userid)
  let output = {}
  if (latest_log_info && latest_log_info.enabled_interventions) {
    return latest_log_info.enabled_interventions
  }
  return output
}

async function get_enabled_interventions_for_users(users){
  output = {}
  for (let user of users) 
    output[user] = await get_enabled_interventions_for_user(user)
  
  return output
}

async function get_disabled_interventions_for_user(userid) {
  let results = await get_collection_for_user(userid, 'synced:interventions_currently_disabled')
  let output = {}
  for (let info of results) {
    let name = info.key
    if (info.val == true) {
      output[name] = true
    } else if (info.val == false) {
      output[name] = false
    }
  }
  return output
}

async function get_disabled_interventions_for_users(users) {
  let output = {}
  for (let user of users) {
    output[user] = await get_disabled_interventions_for_user(user)
  }
  return output
}

async function get_session_info_list_for_install_id(install_id) {
  let user_id = await get_userid_from_install_id(install_id)
  if (user_id == null) {
    return null
  }
  let session_info_list = await get_session_info_list_for_user(user_id)
  return session_info_list.filter((x) => x.install_id == install_id)
}

async function get_domain_to_session_id_to_time_spent(userid) {
  let seconds_on_domain_per_session = await get_collection_for_user_cached(userid, 'synced:seconds_on_domain_per_session')
  let domain_to_session_id_to_time_spent = {}
  for (let item of seconds_on_domain_per_session) {
    let domain = item.key
    let session_id = item.key2
    let seconds_spent = item.val
    if (domain_to_session_id_to_time_spent[domain] == null) {
      domain_to_session_id_to_time_spent[domain] = {}
    }
    if (domain_to_session_id_to_time_spent[domain][session_id] == null) {
      domain_to_session_id_to_time_spent[domain][session_id] = seconds_spent
    } else {
      domain_to_session_id_to_time_spent[domain][session_id] = Math.max(seconds_spent, domain_to_session_id_to_time_spent[domain][session_id])
    }
  }
  return domain_to_session_id_to_time_spent
}

async function get_session_info_list_for_user(userid) {
  let output = []
  let interventions_active_for_domain_and_session = await get_collection_for_user_cached(userid, 'synced:interventions_active_for_domain_and_session')
  let domain_to_session_id_to_time_spent = await get_domain_to_session_id_to_time_spent(userid)
  let last_active_date_for_userid = await list_last_active_date_for_user(userid)
  for (let item of interventions_active_for_domain_and_session) {
    let session_id = item.key2
    let domain = item.key
    let userid_inlog = item.userid
    let interventions_active = JSON.parse(item.val)
    let intervention = interventions_active[0]
    let a = JSON.stringify(intervention)
    console.log(a)
    let timestamp = item.timestamp
    let timestamp_local = item.timestamp_local
    let install_id = item.install_id
    let last_active_date_for_install_id = await list_last_active_date_for_install_id(install_id)
    if (userid_inlog != userid) {
      console.log('mismatch between userid and userid_inlog for userid ' + userid)
      continue
    }
    if (domain_to_session_id_to_time_spent[domain] == null || domain_to_session_id_to_time_spent[domain][session_id] == null) {
      //console.log('warning: missing session duration for session id ' + session_id + ' on domain ' + domain)
      continue
    }
    let time_spent = domain_to_session_id_to_time_spent[domain][session_id]
    output.push({
      last_active_epoch_for_userid: convert_date_to_epoch(last_active_date_for_userid),
      last_active_epoch_for_install_id: convert_date_to_epoch(last_active_date_for_install_id),
      last_active_date_for_userid,
      last_active_date_for_install_id,
      time_spent,
      session_id,
      domain,
      interventions_active,
      intervention,
      timestamp,
      timestamp_local,
      install_id,
      userid,
    })
  }
  return output
}

async function get_session_info_with_experiment_info_for_install_id(install_id) {
  let experiment_info_list = await get_experiment_info_same_vs_random_varlength_deterministic_latinsquare_for_install_id(install_id)
  let session_info_list = await get_session_info_list_for_install_id_detailed(install_id)
  let experiment_info_with_sessions = await group_together_session_info_list_with_experiment_info_list(session_info_list, experiment_info_list)
  return experiment_info_with_sessions
}

async function get_session_info_with_experiment_info_for_userid(userid) {
  let all_install_ids = await get_userid_to_all_install_ids(userid)
  if (all_install_ids == null || all_install_ids.length != 1) {
    return []
  }
  let experiment_info_list = await get_experiment_info_same_vs_random_varlength_deterministic_latinsquare_for_userid(userid)
  let session_info_list = await get_session_info_list_for_user_detailed(userid)
  let experiment_info_with_sessions = await group_together_session_info_list_with_experiment_info_list(session_info_list, experiment_info_list)
  return experiment_info_with_sessions
}

async function get_install_id_to_session_info_with_experiment_info_for_install_ids_in_experiment() {
  let output = {}
  let install_ids_in_experiment = (await get_selection_algorithm_to_install_ids_list_cached())['experiment_alternate_between_same_vs_random_varlength_deterministic_latinsquare']
  for (let install_id of install_ids_in_experiment) {
    output[install_id] = await get_session_info_with_experiment_info_for_install_id(install_id)
  }
  return output
}

let get_install_id_to_session_info_with_experiment_info_for_install_ids_in_experiment_cached = memoize_to_disk_0arg(get_install_id_to_session_info_with_experiment_info_for_install_ids_in_experiment, 'get_install_id_to_session_info_with_experiment_info_for_install_ids_in_experiment')

async function get_userid_to_session_info_with_experiment_info_for_userids_in_experiment() {
  let output = {}
  let user_ids_in_experiment = (await get_selection_algorithm_to_users_list_cached())['experiment_alternate_between_same_vs_random_varlength_deterministic_latinsquare']
  for (let userid of user_ids_in_experiment) {
    let all_install_ids = await get_userid_to_all_install_ids(userid)
    if (all_install_ids == null || all_install_ids.length != 1) {
      continue
    }
    output[userid] = await get_session_info_with_experiment_info_for_userid(userid)
  }
  return output
}

let get_userid_to_session_info_with_experiment_info_for_userids_in_experiment_cached = memoize_to_disk_0arg(get_userid_to_session_info_with_experiment_info_for_userids_in_experiment, 'get_userid_to_session_info_with_experiment_info_for_userids_in_experiment')

/*
async function get_session_info_list_for_install_id_detailed(install_id) {
  let user_id = await get_userid_from_install_id(install_id)
  if (user_id == null) {
    return null
  }
  let session_info_list = await get_session_info_list_for_user_detailed(user_id)
  return session_info_list.filter((x) => x.install_id == install_id)
}
*/

async function get_session_info_list_for_install_id_detailed(install_id) {
  let userid = await get_userid_from_install_id(install_id)
  let output = []
  let interventions_active_for_domain_and_session = await get_collection_for_user_cached(userid, 'synced:interventions_active_for_domain_and_session')
  let domain_to_session_id_to_time_spent = await get_domain_to_session_id_to_time_spent(userid)
  for (let item of interventions_active_for_domain_and_session) {
    let session_id = item.key2
    let domain = item.key
    let userid_inlog = item.userid
    let interventions_active = JSON.parse(item.val)
    let intervention = interventions_active[0]
    let timestamp = item.timestamp
    let timestamp_local = item.timestamp_local
    let install_id = item.install_id
    if (userid_inlog != userid) {
      console.log('mismatch between userid and userid_inlog for userid ' + userid)
      continue
    }
    if (domain_to_session_id_to_time_spent[domain] == null || domain_to_session_id_to_time_spent[domain][session_id] == null) {
      //console.log('warning: missing session duration for session id ' + session_id + ' on domain ' + domain)
      continue
    }
    if (intervention == null) {
      console.log('warning: missing intervention name')
      continue
    }
    let time_spent = domain_to_session_id_to_time_spent[domain][session_id]
    if (time_spent == null) {
      console.log('warning: missing session duration')
      continue
    }
    // TODO when calling from the install id version we might get the wrong session?
    let is_unofficial = await get_is_session_nonofficial_release_for_install_id(install_id, intervention, session_id)
    if (is_unofficial) {
      continue
    }
    let localtime = await get_session_start_localtime_for_install_id(install_id, intervention, session_id)
    if (localtime == null) {
      continue
    }
    let localdate = moment(localtime).format('YYYYMMDD')
    let localepoch = convert_date_to_epoch(localdate)
    let is_preview = await get_is_session_preview_for_install_id(install_id, intervention, session_id)
    output.push({
      time_spent,
      session_id,
      domain,
      interventions_active,
      intervention,
      timestamp,
      timestamp_local,
      localtime,
      localdate,
      localepoch,
      install_id,
      userid,
      is_unofficial,
      is_preview,
    })
  }
  return output
}

let get_session_info_list_for_install_id_detailed_cached = memoize_to_disk_1arg(get_session_info_list_for_install_id_detailed, 'get_session_info_list_for_install_id_detailed')


async function get_session_info_list_for_user_detailed(userid) {
  let output = []
  let interventions_active_for_domain_and_session = await get_collection_for_user_cached(userid, 'synced:interventions_active_for_domain_and_session')
  let domain_to_session_id_to_time_spent = await get_domain_to_session_id_to_time_spent(userid)
  for (let item of interventions_active_for_domain_and_session) {
    let session_id = item.key2
    let domain = item.key
    let userid_inlog = item.userid
    let interventions_active = JSON.parse(item.val)
    let intervention = interventions_active[0]
    let timestamp = item.timestamp
    let timestamp_local = item.timestamp_local
    let install_id = item.install_id
    if (userid_inlog != userid) {
      console.log('mismatch between userid and userid_inlog for userid ' + userid)
      continue
    }
    if (domain_to_session_id_to_time_spent[domain] == null || domain_to_session_id_to_time_spent[domain][session_id] == null) {
      //console.log('warning: missing session duration for session id ' + session_id + ' on domain ' + domain)
      continue
    }
    if (intervention == null) {
      console.log('warning: missing intervention name')
      continue
    }
    let time_spent = domain_to_session_id_to_time_spent[domain][session_id]
    if (time_spent == null) {
      console.log('warning: missing session duration')
      continue
    }
    // TODO when calling from the install id version we might get the wrong session?
    let is_unofficial = await get_is_session_nonofficial_release(userid, intervention, session_id)
    if (is_unofficial) {
      continue
    }
    let localtime = await get_session_start_localtime(userid, intervention, session_id)
    if (localtime == null) {
      continue
    }
    let localdate = moment(localtime).format('YYYYMMDD')
    let localepoch = convert_date_to_epoch(localdate)
    let is_preview = await get_is_session_preview(userid, intervention, session_id)
    output.push({
      time_spent,
      session_id,
      domain,
      interventions_active,
      intervention,
      timestamp,
      timestamp_local,
      localtime,
      localdate,
      localepoch,
      install_id,
      userid,
      is_unofficial,
      is_preview,
    })
  }
  return output
}

let get_session_info_list_for_user_detailed_cached = memoize_to_disk_1arg(get_session_info_list_for_user_detailed, 'get_session_info_list_for_user_detailed')


function convert_session_info_list_to_day_info_list(session_info_list) {
  let localepoch_to_sessions = {}
  for (let session_info of session_info_list) {
    if (localepoch_to_sessions[session_info.localepoch] == null) {
      localepoch_to_sessions[session_info.localepoch] = []
    }
    localepoch_to_sessions[session_info.localepoch].push(session_info)
  }
  let domain_info_list = []
  let localepoch_keys = Object.keys(localepoch_to_sessions).map(x => parseInt(x))
  let first_localepoch = prelude.minimum(localepoch_keys)
  for (let localepoch of localepoch_keys) {
    let user_id_to_install_id_to_domain_to_time_spent_today = {}
    let session_info_for_day = localepoch_to_sessions[localepoch]
    for (let session_info of session_info_for_day) {
      let domain = session_info.domain
      let time_spent = session_info.time_spent
      let userid = session_info.userid
      let install_id = session_info.install_id
      if (user_id_to_install_id_to_domain_to_time_spent_today[userid] == null) {
        user_id_to_install_id_to_domain_to_time_spent_today[userid] = {}
      }
      if (user_id_to_install_id_to_domain_to_time_spent_today[userid][install_id] == null) {
        user_id_to_install_id_to_domain_to_time_spent_today[userid][install_id] = {}
      }
      if (user_id_to_install_id_to_domain_to_time_spent_today[userid][install_id][domain] == null) {
        user_id_to_install_id_to_domain_to_time_spent_today[userid][install_id][domain] = 0
      }
      user_id_to_install_id_to_domain_to_time_spent_today[userid][install_id][domain] += time_spent
    }
    for (let userid of Object.keys(user_id_to_install_id_to_domain_to_time_spent_today)) {
      for (let install_id of Object.keys(user_id_to_install_id_to_domain_to_time_spent_today[userid])) {
        let domain_to_time_spent_today = user_id_to_install_id_to_domain_to_time_spent_today[userid][install_id]
        for (let domain of Object.keys(domain_to_time_spent_today)) {
          domain_info_list.push({
            domain: domain,
            userid: userid,
            install_id: install_id,
            time_spent: domain_to_time_spent_today[domain],
            log_time_spent: Math.log(domain_to_time_spent_today[domain]),
            localepoch: localepoch,
            days_since_install: localepoch - first_localepoch,
          })
        }
      }
    }
  }
  return domain_info_list
}

function group_list_into_dict_by_key(list, key) {
  if (list == null) {
    return {} // TODO why is this necessary?
  }
  let output = {}
  for (let x of list) {
    let val = x[key]
    if (output[val] == null) {
      output[val] = []
    }
    output[val].push(x)
  }
  return output
}

function group_together_session_info_list_with_experiment_info_list(session_info_list, experiment_info_list) {
  let output = []
  let localepoch_to_session_info_list = group_list_into_dict_by_key(session_info_list, 'localepoch')
  for (let experiment_idx = 0; experiment_idx < experiment_info_list.length; ++experiment_idx) {
    let experiment_info = experiment_info_list[experiment_idx]
    let experiment_start_date = experiment_info.day
    let experiment_start_epoch = convert_date_to_epoch(experiment_start_date)
    let conditionduration = experiment_info.conditionduration
    let condition_info_list = []
    let cur_experiment = {
      day: experiment_start_date,
      epoch: experiment_start_epoch,
      duration_order: experiment_info.duration_order,
      duration_idx: experiment_info.duration_idx,
      experiment_idx: experiment_idx,
      conditionduration: conditionduration,
      conditions: experiment_info.conditions,
      condition_info_list: condition_info_list,
    }
    for (let condition_idx = 0; condition_idx < experiment_info.conditions.length; ++condition_idx) {
      let condition = experiment_info.conditions[condition_idx]
      let condition_start_epoch = experiment_start_epoch + conditionduration * condition_idx
      let day_info_list = []
      let condition_info = {
        conditionduration: conditionduration,
        condition_idx: condition_idx,
        condition: condition,
        condition_start_epoch: condition_start_epoch,
        condition_start_date: convert_epoch_to_date(condition_start_epoch),
        day_info_list: day_info_list,
      }
      for (let day_idx = 0; day_idx < conditionduration; ++day_idx) {
        let epoch = condition_start_epoch + day_idx
        let day = convert_epoch_to_date(epoch)
        let session_info_list = []
        if (localepoch_to_session_info_list[epoch] != null) {
          session_info_list = localepoch_to_session_info_list[epoch]
        }
        let day_info = {
          day_idx,
          epoch,
          day,
          session_info_list,
        }
        day_info_list.push(day_info)
      }
      condition_info_list.push(condition_info)
    }
    output.push(cur_experiment)
  }
  return output
}

async function get_experiment_info_same_vs_random_varlength_deterministic_latinsquare_for_install_id(install_id) {
  let userid = await get_userid_from_install_id(install_id)
  let experiment_vars_list = await get_collection_for_user_cached(userid, 'synced:experiment_vars')
  let output = experiment_vars_list.filter((x) => x.key == 'experiment_alternate_between_same_vs_random_varlength_deterministic_latinsquare')
  output = output.filter((x) => x.install_id == install_id)
  output = output.map((x) => JSON.parse(x.val))
  return output
}

async function get_experiment_info_same_vs_random_varlength_deterministic_latinsquare_for_userid(userid) {
  let experiment_vars_list = await get_collection_for_user_cached(userid, 'synced:experiment_vars')
  let output = experiment_vars_list.filter((x) => x.key == 'experiment_alternate_between_same_vs_random_varlength_deterministic_latinsquare')
  output = output.map((x) => JSON.parse(x.val))
  return output
}

let cache_get_intervention_first_entry_in_session = {}

async function get_intervention_first_entry_in_session(userid, intervention_name, session_id) {
  if (cache_get_intervention_first_entry_in_session[userid] != null && cache_get_intervention_first_entry_in_session[userid][intervention_name] != null) {
    return cache_get_intervention_first_entry_in_session[userid][intervention_name][session_id]
  }
  if (cache_get_intervention_first_entry_in_session[userid] == null) {
    cache_get_intervention_first_entry_in_session[userid] = {}
  }
  if (cache_get_intervention_first_entry_in_session[userid][intervention_name] == null) {
    cache_get_intervention_first_entry_in_session[userid][intervention_name] = {}
  }
  let intervention_logs = await get_intervention_logs_for_user(userid, intervention_name)
  //intervention_logs = intervention_logs.filter((x) => x.session_id == session_id)
  for (let x of intervention_logs) {
    let timestamp = x.timestamp
    if (timestamp == null) {
      continue
    }
    let cur_session_id = x.session_id
    if (cur_session_id == null) {
      continue
    }
    let existing_item = cache_get_intervention_first_entry_in_session[userid][intervention_name][session_id]
    if (existing_item == null || timestamp < existing_item.timestamp) {
      cache_get_intervention_first_entry_in_session[userid][intervention_name][cur_session_id] = x
    }
  }
  return cache_get_intervention_first_entry_in_session[userid][intervention_name][session_id]
}

let cache_get_intervention_first_entry_in_session_for_install_id = {}

async function get_intervention_first_entry_in_session_for_install_id(install_id, intervention_name, session_id) {
  let user_id = await get_userid_from_install_id(install_id)
  if (cache_get_intervention_first_entry_in_session_for_install_id[install_id] != null && cache_get_intervention_first_entry_in_session_for_install_id[install_id][intervention_name] != null) {
    return cache_get_intervention_first_entry_in_session_for_install_id[install_id][intervention_name][session_id]
  }
  if (cache_get_intervention_first_entry_in_session_for_install_id[install_id] == null) {
    cache_get_intervention_first_entry_in_session_for_install_id[install_id] = {}
  }
  if (cache_get_intervention_first_entry_in_session_for_install_id[install_id][intervention_name] == null) {
    cache_get_intervention_first_entry_in_session_for_install_id[install_id][intervention_name] = {}
  }
  let intervention_logs = await get_intervention_logs_for_user(user_id, intervention_name)
  //intervention_logs = intervention_logs.filter((x) => x.session_id == session_id)
  for (let x of intervention_logs) {
    let timestamp = x.timestamp
    if (timestamp == null) {
      continue
    }
    let cur_session_id = x.session_id
    if (cur_session_id == null) {
      continue
    }
    if (x.install_id != install_id) {
      continue
    }
    let existing_item = cache_get_intervention_first_entry_in_session_for_install_id[install_id][intervention_name][session_id]
    if (existing_item == null || timestamp < existing_item.timestamp) {
      cache_get_intervention_first_entry_in_session_for_install_id[install_id][intervention_name][cur_session_id] = x
    }
  }
  return cache_get_intervention_first_entry_in_session_for_install_id[install_id][intervention_name][session_id]
}


async function get_session_start_localtime(userid, intervention_name, session_id) {
  /*
  let intervention_logs = await get_intervention_logs_for_user(userid, intervention_name)
  intervention_logs = intervention_logs.filter((x) => x.session_id == session_id)
  let firstentry = prelude.minimumBy((x) => x.timestamp, intervention_logs)
  */
  let firstentry = await get_intervention_first_entry_in_session(userid, intervention_name, session_id)
  if (firstentry == null) {
    return null
  }
  return firstentry.localtime
}

async function get_session_start_localtime_for_install_id(install_id, intervention_name, session_id) {
  /*
  let intervention_logs = await get_intervention_logs_for_user(userid, intervention_name)
  intervention_logs = intervention_logs.filter((x) => x.session_id == session_id)
  let firstentry = prelude.minimumBy((x) => x.timestamp, intervention_logs)
  */
  let firstentry = await get_intervention_first_entry_in_session_for_install_id(install_id, intervention_name, session_id)
  if (firstentry == null) {
    return null
  }
  return firstentry.localtime
}

async function get_is_session_preview(userid, intervention_name, session_id) {
  /*
  let intervention_logs = await get_intervention_logs_for_user(userid, intervention_name)
  intervention_logs = intervention_logs.filter((x) => x.session_id == session_id)
  let firstentry = prelude.minimumBy((x) => x.timestamp, intervention_logs)
  */
  let firstentry = await get_intervention_first_entry_in_session(userid, intervention_name, session_id)
  if (firstentry == null) {
    return null
  }
  return firstentry.is_preview_mode
}

async function get_is_session_preview_for_install_id(install_id, intervention_name, session_id) {
  /*
  let intervention_logs = await get_intervention_logs_for_user(userid, intervention_name)
  intervention_logs = intervention_logs.filter((x) => x.session_id == session_id)
  let firstentry = prelude.minimumBy((x) => x.timestamp, intervention_logs)
  */
  let firstentry = await get_intervention_first_entry_in_session_for_install_id(install_id, intervention_name, session_id)
  if (firstentry == null) {
    return null
  }
  return firstentry.is_preview_mode
}

async function get_is_session_nonofficial_release(userid, intervention_name, session_id) {
  let firstentry = await get_intervention_first_entry_in_session(userid, intervention_name, session_id)
  if (firstentry == null) {
    return false
  }
  if (firstentry.developer_mode) {
    return true
  }
  if (firstentry.unofficial_version) {
    return true
  }
  return false
}

async function get_is_session_nonofficial_release_for_install_id(install_id, intervention_name, session_id) {
  let firstentry = await get_intervention_first_entry_in_session_for_install_id(install_id, intervention_name, session_id)
  if (firstentry == null) {
    return false
  }
  if (firstentry.developer_mode) {
    return true
  }
  if (firstentry.unofficial_version) {
    return true
  }
  return false
}

/*
async function get_enabled_goals_for_user(userid) {
  let latest_log_info = await get_latest_intervention_info_for_user(userid)
  let output = {}
  if (latest_log_info && latest_log_info.enabled_goals) {
    return latest_log_info.enabled_goals
  }
  return output
}
*/

async function list_intervention_logs_for_user(userid) {
  let all_logs = await getjson('/list_logs_for_user' , {userid: userid})
  let output = []
  for (let log_name of all_logs) {
    let base_log_name = log_name.replace(userid + '_', '')
    output.push(base_log_name)
  }
  return output
}

let list_logs_for_all_users = async function() {
  let all_collections = await listcollections()
  let output = {}
  for (let full_collection_name of all_collections) {
    let underscore_idx = full_collection_name.indexOf('_')
    if (underscore_idx == -1) {
      continue
    }
    let userid = full_collection_name.substr(0, underscore_idx)
    let collection_name = full_collection_name.substr(underscore_idx + 1)
    if (output[userid] == null) {
      output[userid] = []
    }
    output[userid].push(collection_name)
  }
  return output
}

let list_logs_for_all_users_cached = memoize_to_disk_0arg(list_logs_for_all_users, 'list_logs_for_all_users')

let list_intervention_logs_for_all_users = async function() {
  let all_collections = await listcollections()
  let output = {}
  for (let full_collection_name of all_collections) {
    let underscore_idx = full_collection_name.indexOf('_')
    if (underscore_idx == -1) {
      continue
    }
    let userid = full_collection_name.substr(0, underscore_idx)
    let collection_name = full_collection_name.substr(underscore_idx + 1)
    if (collection_name.startsWith('synced:') || collection_name.startsWith('logs:')) {
      continue
    }
    if (output[userid] == null) {
      output[userid] = []
    }
    output[userid].push(collection_name)
  }
  return output
}

let list_intervention_logs_for_all_users_cached = memoize_to_disk_0arg(list_intervention_logs_for_all_users, 'list_intervention_logs_for_all_users')

let get_time_until_user_changed_interventions = async function(userid) {
  let intervention_logs = await get_collection_for_user(userid, 'logs:interventions')
  let first_intervention_enabled = null
  let first_intervention_disabled = null
  let first_intervention_changed = null
  let experiment_start = null
  for (let x of intervention_logs) {
    if (x.type == 'default_interventions_on_install') {
      if (x.interventions_per_goal != null && x.enabled_interventions != null) {
        if (experiment_start == null || x.timestamp < experiment_start)
          experiment_start = x.timestamp
      }
    }
    if (x.type == 'intervention_set_smartly_managed') {
      if (first_intervention_enabled == null || x.timestamp < first_intervention_enabled)
        first_intervention_enabled = x.timestamp
      if (first_intervention_changed == null || x.timestamp < first_intervention_changed)
        first_intervention_changed = x.timestamp
    }
    if (x.type == 'intervention_set_always_disabled') {
      if (first_intervention_disabled == null || x.timestamp < first_intervention_disabled)
        first_intervention_disabled = x.timestamp
      if (first_intervention_changed == null || x.timestamp < first_intervention_changed)
        first_intervention_changed = x.timestamp
    }
  }
  let output = {}
  if (experiment_start != null) {
    output.experiment_start = experiment_start
  }
  if (experiment_start != null && first_intervention_enabled != null) {
    output.milliseconds_until_first_intervention_enabled = first_intervention_enabled - experiment_start
  }
  if (experiment_start != null && first_intervention_disabled != null) {
    output.milliseconds_until_first_intervention_disabled = first_intervention_disabled - experiment_start
  }
  if (experiment_start != null && first_intervention_changed != null) {
    output.milliseconds_until_first_intervention_changed = first_intervention_changed - experiment_start
  }
  return output
}

let get_time_until_user_changed_interventions_cached = memoize_to_disk_1arg(get_time_until_user_changed_interventions, 'get_time_until_user_changed_interventions')

let get_seconds_on_domain_per_day_epoch_for_user = async function(userid) {
  let timespent_logs = await get_collection_for_user(userid, 'synced:seconds_on_domain_per_day')
  let output = {}
  // domain -> day (epoch) -> seconds
  for (let x of timespent_logs) {
    let day = x.key2
    let domain = x.key
    let timespent = x.val
    if (output[domain] == null) {
      output[domain] = {}
    }
    if (output[domain][day] == null) {
      output[domain][day] = timespent
    } else {
      output[domain][day] = Math.max(timespent, output[domain][day])
    }
  }
  return output
}

let get_seconds_on_domain_per_day_epoch_for_user_cached = memoize_to_disk_1arg(get_seconds_on_domain_per_day_epoch_for_user, 'get_seconds_on_domain_per_day_epoch_for_user')

async function get_seconds_on_domain_per_day_since_install_for_user_cached(userid) {
  let output = {}
  let seconds_on_domain_per_epoch_for_user = await get_seconds_on_domain_per_day_epoch_for_user_cached(userid)
  for (let domain of Object.keys(seconds_on_domain_per_epoch_for_user)) {
    output[domain] = {}
    let days = Object.keys(seconds_on_domain_per_epoch_for_user[domain]).map(x => parseInt(x))
    let firstday = prelude.minimum(days)
    for (let epoch_day of days) {
      let days_since_install = epoch_day - firstday
      output[domain][days_since_install] = seconds_on_domain_per_epoch_for_user[domain][epoch_day]
    }
  }
  return output
}

let get_experiment_info_for_user = async function(userid) {
  let intervention_logs = await get_collection_for_user(userid, 'logs:interventions')
  for (let x of intervention_logs) {
    if (x.type == 'default_interventions_on_install') {
      if (x.interventions_per_goal != null && x.enabled_interventions != null) {
        return x
      }
    }
  }
  return 'none'
}

let get_experiment_info_for_user_cached = memoize_to_disk_1arg(get_experiment_info_for_user, 'get_experiment_info_for_user')

let get_all_experiment_info_for_user = async function(userid) {
  let intervention_logs = await get_collection_for_user(userid, 'logs:interventions')
  let output = []
  for (let x of intervention_logs) {
    if (x.type == 'default_interventions_on_install') {
      if (x.interventions_per_goal != null && x.enabled_interventions != null) {
        output.push(x)
      }
    }
  }
  return output
}

let get_all_experiment_info_for_user_cached = memoize_to_disk_1arg(get_all_experiment_info_for_user, 'get_all_experiment_info_for_user')

let get_experiment_date_for_user = async function(userid) {
  let experiment_info = await get_experiment_info_for_user(userid)
  if (experiment_info != null && experiment_info != 'none' && experiment_info.timestamp != null) {
    return moment(experiment_info.timestamp).tz("America/Los_Angeles").format('YYYYMMDD')
  }
  return 'none'
}

let get_experiment_date_for_user_cached = async function(userid) {
  let experiment_info = await get_experiment_info_for_user_cached(userid)
  if (experiment_info != null && experiment_info != 'none' && experiment_info.timestamp != null) {
    return moment(experiment_info.timestamp).tz("America/Los_Angeles").format('YYYYMMDD')
  }
  return 'none'
}

let get_experiment_condition_for_user = async function(userid) {
  let experiment_info = await get_experiment_info_for_user(userid)
  if (experiment_info != null && experiment_info != 'none' && experiment_info.interventions_per_goal != null) {
    return experiment_info.interventions_per_goal
  }
  return 'none'
}

let get_experiment_condition_for_user_cached = async function(userid) {
  let experiment_info = await get_experiment_info_for_user_cached(userid)
  if (experiment_info != null && experiment_info != 'none' && experiment_info.interventions_per_goal != null) {
    return experiment_info.interventions_per_goal
  }
  return 'none'
}

let get_default_interventions_for_user = async function(userid) {
  let experiment_info = await get_experiment_info_for_user(userid)
  if (experiment_info != null && experiment_info != 'none' && experiment_info.enabled_interventions != null) {
    return experiment_info.enabled_interventions
  }
  return 'none'
}

let get_default_interventions_for_user_cached = async function(userid) {
  let experiment_info = await get_experiment_info_for_user_cached(userid)
  if (experiment_info != null && experiment_info != 'none' && experiment_info.enabled_interventions != null) {
    return experiment_info.enabled_interventions
  }
  return 'none'
}

let get_did_user_complete_onboarding = async function(userid) {
  let pages_logs = await get_collection_for_user(userid, 'logs:pages')
  for (let x of pages_logs) {
    if (x.reason == 'onboarding-complete') {
      return true
    }
  }
  return false
}

let get_did_user_complete_onboarding_cached = memoize_to_disk_1arg(get_did_user_complete_onboarding, 'get_did_user_complete_onboarding')

async function list_first_active_date_for_all_users() {
  let user_to_dates_active = await get_user_to_dates_active_cached()
  let output = {}
  for (let userid of Object.keys(user_to_dates_active)) {
    let dates_active = user_to_dates_active[userid]
    output[userid] = dates_active[0]
  }
  return output
}

async function list_last_active_date_for_all_users() {
  let user_to_dates_active = await get_user_to_dates_active_cached()
  let output = {}
  for (let userid of Object.keys(user_to_dates_active)) {
    let dates_active = user_to_dates_active[userid]
    output[userid] = dates_active[dates_active.length - 1]
  }
  return output
}

async function list_first_active_date_for_all_users_since_today() {
  let today = moment().hours(0).minutes(0).seconds(0).milliseconds(0)
  let user_to_first_active_date = await list_first_active_date_for_all_users()
  let output = {}
  for (let userid of Object.keys(user_to_first_active_date)) {
    let first_active = user_to_first_active_date[userid]
    output[userid] = Math.round(moment.duration(today.diff(first_active)).asDays())
  }
  return output
}

async function list_last_active_date_for_all_users_since_today() {
  let today = moment().hours(0).minutes(0).seconds(0).milliseconds(0)
  let user_to_last_active_date = await list_last_active_date_for_all_users()
  let output = {}
  for (let userid of Object.keys(user_to_last_active_date)) {
    let last_active = user_to_last_active_date[userid]
    output[userid] = Math.round(moment.duration(today.diff(last_active)).asDays())
  }
  return output
}

async function list_first_active_date_for_all_install_ids_since_today() {
  let today = moment().hours(0).minutes(0).seconds(0).milliseconds(0)
  let install_id_to_first_active_date = await list_first_active_date_for_all_install_ids()
  let output = {}
  for (let install_id of Object.keys(install_id_to_first_active_date)) {
    let first_active = install_id_to_first_active_date[install_id]
    output[install_id] = Math.round(moment.duration(today.diff(first_active)).asDays())
  }
  return output
}

async function list_last_active_date_for_all_install_ids_since_today() {
  let today = moment().hours(0).minutes(0).seconds(0).milliseconds(0)
  let install_id_to_last_active_date = await list_last_active_date_for_all_install_ids()
  let output = {}
  for (let install_id of Object.keys(install_id_to_last_active_date)) {
    let last_active = install_id_to_last_active_date[install_id]
    output[install_id] = Math.round(moment.duration(today.diff(last_active)).asDays())
  }
  return output
}

async function list_first_active_date_for_all_install_ids() {
  let install_id_to_dates_active = await get_install_id_to_dates_active_cached()
  let output = {}
  for (let install_id of Object.keys(install_id_to_dates_active)) {
    let dates_active = install_id_to_dates_active[install_id]
    output[install_id] = dates_active[0]
  }
  return output
}

async function list_last_active_date_for_all_install_ids() {
  let install_id_to_dates_active = await get_install_id_to_dates_active_cached()
  let output = {}
  for (let install_id of Object.keys(install_id_to_dates_active)) {
    let dates_active = install_id_to_dates_active[install_id]
    output[install_id] = dates_active[dates_active.length - 1]
  }
  return output
}

async function list_first_active_date_for_user(userid) {
  let user_to_dates_active = await get_user_to_dates_active_cached()
  let dates_active = user_to_dates_active[userid]
  return dates_active[0]
}

async function list_last_active_date_for_install_id(install_id) {
  let install_id_to_dates_active = await get_install_id_to_dates_active_cached()
  let dates_active = install_id_to_dates_active[install_id]
  return dates_active[0]
}

async function list_last_active_date_for_user(userid) {
  let user_to_dates_active = await get_user_to_dates_active_cached()
  let dates_active = user_to_dates_active[userid]
  return dates_active[dates_active.length - 1]
}

async function list_first_active_date_for_user_since_today(userid) {
  let today = moment().hours(0).minutes(0).seconds(0).milliseconds(0)
  let first_active = await list_first_active_date_for_user(userid)
  return Math.round(moment.duration(today.diff(first_active)).asDays())
}

async function list_last_active_date_for_user_since_today(userid) {
  let today = moment().hours(0).minutes(0).seconds(0).milliseconds(0)
  let last_active = await list_last_active_date_for_user(userid)
  return Math.round(moment.duration(today.diff(last_active)).asDays())
}

async function get_num_intervention_impressions_on_domain_per_day(userid, domain) {
  let interventions_active_for_domain_and_session = await get_collection_for_user_cached('synced:interventions_active_for_domain_and_session')
  let day_to_num_impressions = {}
  for (let session_info of interventions_active_for_domain_and_session) {
    if (session_info.key != domain) {
      continue
    }
    let date = moment(session_info.timestamp).tz("America/Los_Angeles").format('YYYYMMDD')
    if (day_to_num_impressions[date] == null) {
      day_to_num_impressions[date] = 0
    }
    day_to_num_impressions[date] += 1
  }
  return day_to_num_impressions
}

function convert_date_to_epoch(date) {
  let start_of_epoch = moment().year(2016).month(0).date(1).hours(0).minutes(0).seconds(0).milliseconds(0)
  let year = parseInt(date.substr(0, 4))
  let month = parseInt(date.substr(4, 2)) - 1
  let day = parseInt(date.substr(6, 2))
  let date_moment = moment().year(year).month(month).date(day).hours(0).minutes(0).seconds(0).milliseconds(0)
  return date_moment.diff(start_of_epoch, 'days')
}

function convert_epoch_to_date(epoch) {
  let start_of_epoch = moment().year(2016).month(0).date(1).hours(0).minutes(0).seconds(0).milliseconds(0)
  start_of_epoch.add(epoch, 'days')
  return start_of_epoch.format('YYYYMMDD')
}

function timestamp_to_epoch(timestamp) {
  let start_of_epoch = moment().year(2016).month(0).date(1).hours(0).minutes(0).seconds(0).milliseconds(0)
  return moment(timestamp).diff(start_of_epoch, 'days')
}

function convert_timestamp_to_days_since_today(timestamp) {
  let today = moment().hours(0).minutes(0).seconds(0).milliseconds(0)
  return Math.round(moment.duration(today.diff(timestamp)).asDays())
}

function convert_date_to_days_since_today(date) {
  let today = moment().hours(0).minutes(0).seconds(0).milliseconds(0)
  return Math.round(moment.duration(today.diff(date)).asDays())
}

async function get_num_intervention_impressions_on_domain_per_epoch_day(userid, domain) {
  let interventions_active_for_domain_and_session = await get_collection_for_user_cached(userid, 'synced:interventions_active_for_domain_and_session')
  let day_to_num_impressions = {}
  for (let session_info of interventions_active_for_domain_and_session) {
    if (session_info.key != domain) {
      continue
    }
    let date = timestamp_to_epoch(session_info.timestamp)
    if (day_to_num_impressions[date] == null) {
      day_to_num_impressions[date] = 0
    }
    day_to_num_impressions[date] += 1
  }
  return day_to_num_impressions
}

async function get_retention_curves_for_users(user_list, days_to_analyze) {
  let user_to_first_active_since_today = await list_first_active_date_for_all_users_since_today()
  let user_to_last_active_since_today = await list_last_active_date_for_all_users_since_today()
  let retention_data = Array(days_to_analyze + 1).fill(0)
  for (let userid of user_list) {
    let first_active = user_to_first_active_since_today[userid]
    if (first_active < days_to_analyze) {
      continue
    }
    let last_active = user_to_last_active_since_today[userid]
    let days_active = first_active - last_active
    for (let i = 0; i <= Math.min(days_active, days_to_analyze); ++i) {
      retention_data[i] += 1
    }
  }
  return retention_data
}

async function get_lifetimes_and_whether_attrition_was_observed_for_users(user_list) {
  console.log('running get_lifetimes_and_whether_attrition_was_observed_for_users')
  let lifetimes = []
  let attritions = []
  let user_to_first_active_since_today = await list_first_active_date_for_all_users_since_today()
  let user_to_last_active_since_today = await list_last_active_date_for_all_users_since_today()
  for (let userid of user_list) {
    let first_active = user_to_first_active_since_today[userid]
    if (first_active == null) {
      console.log("first_active is null")
      console.log(userid)
      continue
    }
    let last_active = user_to_last_active_since_today[userid]
    if (last_active == null) {
      console.log("last_active is null")
      console.log(userid)
      continue
    }
    let days_active = first_active - last_active
    if (days_active < 0) {
      console.log("days_active is negative")
      console.log(userid)
      continue
    }
    //if (days_active > 22) {
    //  console.log("days_active is too large")
    //  console.log(userid)
    //}
    let attritioned = 1
    if (last_active <= 3) { // within 3 days
      attritioned = 0
    }
    lifetimes.push(days_active)
    attritions.push(attritioned)
  }
  return [lifetimes,
    attritions
  ]
}

async function get_lifetime_and_attrition_for_users(users) {
  console.log('running : get_lifetime_and_attrition_for_users')
  let lifetimes = []
  let attritioned = []
  let user_to_install_ids = await get_user_to_all_install_ids_cached()
  console.log(user_to_install_ids)
  let res = await get_lifetimes_and_whether_attrition_was_observed_for_users(users)
  lifetimes = res[0]
  attritioned = res[1]
  let obj = {}
  console.log(users)
  for (let i = 0; i < users.length; i++) {
    let install_ids = await get_userid_to_all_install_ids(users[i])
    if (!install_ids || install_ids.length != 1)
      continue
    obj[users[i]] = {}
    obj[users[i]]['lifetime'] = lifetimes[i]
    obj[users[i]]['attritioned'] = attritioned[i]  
  }
  console.log('done: get_lifetime_and_attrition_for_users')
  return obj
}

async function get_intervention_polling_results() {
  let users = await get_all_users_in_experiment_by_name('intervention_intensity_polling_abtest')
  let res = {}
  for (let user of users) {
    let pollres = await get_collection_for_user(user, 'synced:interventions_to_intensity_ratings')
    console.log(pollres)
    for (let i of pollres)
      if (res[i.key])
        res[i.key].push(i.val)
      else {
        res[i.key] = []
        res[i.key].push(i.val)
      }
  }

  console.log("done intervention polling")

  return res
}

async function get_intervention_polling_for_users() {
  let users = await get_all_users_in_experiment_by_name('intervention_intensity_polling_abtest')
  let res = {}
  for (let user of users) {
    let pollres = await get_collection_for_user(user, 'synced:interventions_to_intensity_ratings')
    console.log(pollres)
    res[user] = {}
    for (let i of pollres)
      if (res[user][i.key])
        res[user][i.key].push(i.val)
      else {
        res[user][i.key] = []
        res[user][i.key].push(i.val)
      }
  }

  console.log("done intervention polling")

  return res
}

async function get_fist_active_date_for_user(userid) {
  let user_to_first_active_since_today = await list_first_active_date_for_all_users_since_today()
  return user_to_first_active_since_today[userid]
}
async function get_lifetime_and_attrition_for_users_in_experiment_and_values(experiment, values){
  let res = {}
  let user_to_first_active_since_today = await list_first_active_date_for_all_users_since_today()
  console.log('running : get_lifetime_and_attrition_for_users_in_experiment_and_values')
  if (values.length == 0) {
    let users = await get_all_users_in_experiment_by_name(experiment)
    res = await get_lifetime_and_attrition_for_users(users)
  }
  else {
    res = {}
    for (let value of values) {
      let users = await get_all_users_in_experiment_by_name_and_value(experiment, value)
      
      let smp = await get_lifetime_and_attrition_for_users(users)
      for (let user of Object.keys(smp)) {
        smp[user][experiment] = value
        smp[user]['first_active'] = user_to_first_active_since_today[user]
      }
      for (let key of Object.keys(smp)) {
        res[key] = smp[key]
      }
      //res = Object.assign({}, res, smp)

    }
  }

  console.log('done: get_lifetime_and_attrition_for_users_in_experiment_and_values')
  return res
}
//async function get_intervention_to_num_impressions_for_user(userid) {
  //let interventions_with_data = await get_
//}

function expose_getjson(func_name, ...params) {
  let func_body = null
  let request_path = '/' + func_name
  window[func_name] = async function(...args) {
    let data = {}
    for (let i = 0; i < params.length; ++i) {
      let param = params[i]
      let value = args[i]
      data[param] = value
    }
    return await getjson(request_path, data)
  }
  window[func_name + '_cached'] = memoize_to_disk_nargs(async function(...args) {
    let data = {}
    for (let i = 0; i < params.length; ++i) {
      let param = params[i]
      let value = args[i]
      data[param] = value
    }
    return await getjson(request_path, data)
  }, func_name, params.length)
}

function expose_getjson_cached(func_name, ...params) {
  let func_body = null
  let request_path = '/' + func_name
  window[func_name] = memoize_to_disk_nargs(async function(...args) {
    let data = {}
    for (let i = 0; i < params.length; ++i) {
      let param = params[i]
      let value = args[i]
      data[param] = value
    }
    return await getjson(request_path, data)
  }, func_name, params.length)
}

function make_getjson(func_name, ...params) {
  let func_body = null
  let request_path = '/' + func_name
  return async function(...args) {
    let data = {}
    for (let i = 0; i < params.length; ++i) {
      let param = params[i]
      let value = args[i]
      data[param] = value
    }
    return await getjson(request_path, data)
  }
}

expose_getjson('get_time_last_log_was_sent_for_user', 'userid')

expose_getjson('get_last_intervention_seen_and_time', 'userid')

expose_getjson('get_interventions_disabled_and_sources', 'userid')

expose_getjson('get_interventions_enabled_and_sources', 'userid')

expose_getjson('get_intervention_to_time_most_recently_seen', 'userid')

expose_getjson_cached('get_last_intervention_seen', 'userid')

expose_getjson('list_logs_for_user', 'userid')

expose_getjson('get_dates_active_for_user', 'userid')

expose_getjson('get_user_to_day_last_seen', 'userid')

expose_getjson('get_is_logging_enabled_for_user', 'userid')

expose_getjson('get_user_to_is_logging_enabled')

expose_getjson('listcollections')

expose_getjson('get_installs')

expose_getjson('get_uninstalls')

expose_getjson_cached('get_intervention_to_num_times_seen', 'userid')

expose_getjson_cached('get_intervention_to_num_times_seen_newsession_nonpreview', 'userid')

expose_getjson('get_users_with_logs_who_are_no_longer_active')

expose_getjson('get_last_interventions_for_former_users')

expose_getjson('get_last_interventions_and_num_impressions_for_former_users')

expose_getjson('get_user_to_dates_active')

expose_getjson('get_install_id_to_dates_active')

expose_getjson('get_user_to_install_times')

expose_getjson('get_user_to_uninstall_times')

expose_getjson('get_user_to_all_install_info')

expose_getjson('get_user_to_all_install_times')

expose_getjson('get_user_to_all_uninstall_info')

expose_getjson('get_user_to_all_uninstall_times')

expose_getjson('get_user_to_all_install_ids')

expose_getjson('get_user_to_is_unofficial')

//expose_getjson('get_last_interventions_and_num_impressions_for_former_users')

expose_getjson('get_web_visit_actions')

expose_getjson('get_ideas_votes', 'website')

expose_getjson('get_idea_candidates', 'website')

async function get_intervention_to_attrition_probability() {
  let intervention_to_num_times_seen_last = await get_intervention_to_num_times_seen_last()
  let intervention_to_num_times_seen_total = await get_intervention_to_num_times_seen_total()
  let output = {}
  for (let intervention_name of Object.keys(intervention_to_num_times_seen_total)) {
    let num_times_seen_last = 0
    if (intervention_to_num_times_seen_last[intervention_name] != null) {
      num_times_seen_last = intervention_to_num_times_seen_last[intervention_name]
    }
    let num_times_seen_total = intervention_to_num_times_seen_total[intervention_name]
    output[intervention_name] = num_times_seen_last / num_times_seen_total
  }
  return output
}

async function get_intervention_to_num_times_seen_total() {
  let user_to_is_logging_enabled = await get_user_to_is_logging_enabled()
  let user_list = []
  for (let user_id of Object.keys(user_to_is_logging_enabled)) {
    if (user_to_is_logging_enabled[user_id]) {
      user_list.push(user_id)
    }
  }
  let output = {}
  for (let user_id of user_list) {
    let intervention_to_num_times_seen = await get_intervention_to_num_times_seen(user_id)
    for (let intervention of Object.keys(intervention_to_num_times_seen)) {
      let num_times_seen = intervention_to_num_times_seen[intervention]
      if (output[intervention] == null) {
        output[intervention] = 0
      }
      output[intervention] += num_times_seen
    }
  }
  return output
}

async function get_intervention_to_num_times_seen_last() {
  let intervention_to_num_times_seen_last = {}
  let former_user_list = await get_users_with_logs_who_are_no_longer_active()
  for (let userid of former_user_list) {
    let intervention_name = await get_last_intervention_seen(userid)
    //if (intervention_name == null) {
    //  console.log('last intervention not seen')
    //  console.log(userid)
    //}
    if (intervention_to_num_times_seen_last[intervention_name] == null) {
      intervention_to_num_times_seen_last[intervention_name] = 0
    }
    intervention_to_num_times_seen_last[intervention_name] += 1
  }
  return intervention_to_num_times_seen_last
}

async function get_all_web_visit_actions() {
  let visit_info_list = await get_web_visit_actions()
  let output = []
  for (let visit_info of visit_info_list) {
    if (visit_info.domain != 'habitlab.stanford.edu') {
      continue
    }
    output.push(visit_info)
  }
  return output
}

async function get_web_visits() {
  let visit_info_list = await get_all_web_visit_actions()
  let output = []
  for (let visit_info of visit_info_list) {
    if (visit_info.action != 'visit') {
      continue
    }
    output.push(visit_info)
  }
  return output
}

async function get_web_install_clicks() {
  let visit_info_list = await get_all_web_visit_actions()
  let output = []
  for (let visit_info of visit_info_list) {
    if (visit_info.action != 'install_clicked') {
      continue
    }
    output.push(visit_info)
  }
  return output
}

async function get_intervention_for_users() {
  //gets availability of each intervention for users 
  let res = {}
  let users = await get_all_users_with_experiment_vars()
  for (let user of users) {
    //console.log(user)
   tmp = await get_collection_for_user(user, 'logs:interventions')
   if (tmp.length >= 1) {
      tmp2 = tmp[0]["enabled_interventions"]
      res[user] = tmp2
    }
  }
  console.log("done intervention for users")
  return res
}

async function get_users_with_all_interventions_enabled() {
  var res = []
  usersToInterventions = await get_intervention_for_users()
  for (var user in usersToInterventions) {
    if (usersToInterventions.hasOwnProperty(user)) {
      canadd = true
      for (var intervention in usersToInterventions[user]) {
        if (usersToInterventions[user].hasOwnProperty(intervention)) {
           if (!usersToInterventions[user][intervention])
              canadd = false;
        }
      }
      if (canadd)
        res.push(user)
    }
  }

  console.log("done get users with all interventions enabled")
  return res
}

async function get_session_lengths_with_intervention_users(users) {
  res = {}
  i = 0
  for (i = 0; i < users.length; i++) {
      let user = users[i] 
      res[user] = await get_session_lengths_with_intervention(user)
      console.log(user)
  }

  console.log(res)
  console.log("done get session lengths with interventions users")  
  return res
  
}

async function get_session_lengths_with_intervention_users_with_all_interventions_enabled() {
  let users = await get_users_with_all_interventions_enabled()
  res =  await get_session_lengths_with_intervention_users(users)
  console.log("done get session length with intervention users with all interventions enabld")
  console.log(users)
  console.log(res)
  return res  
}

async function get_all_intervention_effectiveness() {
  let domain_to_intervention_to_session_lengths;
  domain_to_intervention_to_session_lengths = await get_session_lengths_with_intervention_all_users()
  let domain_and_intervention_effectiveness_list = []
  for (let domain of Object.keys(domain_to_intervention_to_session_lengths)) {
    let intervention_info_list = []
    let intervention_to_session_lengths = domain_to_intervention_to_session_lengths[domain]
    for (let intervention_name of Object.keys(intervention_to_session_lengths)) {
      let session_lengths = intervention_to_session_lengths[intervention_name]
      let mean_session_length = prelude.mean(session_lengths)
      let standard_deviation = math.std(session_lengths)
      let confidence_interval = 1.645 * standard_deviation / Math.sqrt(session_lengths.length) // 90% confidence is 1.645, 95% confidence is 1.96
      intervention_info_list.push([
        intervention_name,
        mean_session_length,
        mean_session_length + confidence_interval,
        mean_session_length - confidence_interval,
      ])
    }
    domain_and_intervention_effectiveness_list.push({
      domain: domain,
      intervention_info_list: intervention_info_list
    })
  }

  return domain_and_intervention_effectiveness_list;
}

async function get_acceptance_rates() {
  console.log("new")
  /*let users = await get_all_users_in_experiment_by_name('intervention_suggestion_optout')
  let obj = {}
  for (let user of users)
    obj[user] = true
  let rate = {optout: {},
              optin: {},
              total: {}
            }
  console.log(obj)
  let collections = await listcollections()
  for (let x of collections) {
     let smp = x.split('_')
      if (obj[smp[0]]) {
        let col = await get_collection(x)
        for (let tmp of col) {
          if (tmp['optout'] || tmp['suggestion_optout']) {
            console.log('optout')
            if (tmp['action'] == 'accepted')
                if (!rate['optout'][tmp['intervention']]) 
                  rate['optout'][tmp['intervention']] = {suggested:0, rejected:0}
                rate['optout'][tmp['intervention']]['suggested'] += 1
            if (tmp['action'] == 'rejected')
              rate['optout'][tmp['intervention']]['rejected'] += 1
          }
          else if (tmp['type'] == "suggested") {
            console.log(optin)
            if (!rate['optin'][tmp['intervention']]) 
              rate['optin'][tmp['intervention']] = {suggested:0, accepted:0}
            rate['optin'][tmp['intervention']]['suggested'] += 1
          }
          else if (tmp['type'] == 'suggestion_action' && tmp['action'] == 'accepted')
            rate['optin'][tmp['intervention']]['accepted'] += 1
        }
      }
  }
  return rate;*/

}

async function get_all_page_click_to() {
  let user_to_is_logging_enabled = await get_user_to_is_logging_enabled()
  let user_list = []
  for (let username of Object.keys(user_to_is_logging_enabled)) {
    if (user_to_is_logging_enabled[username]) {
      user_list.push(username)
    }
  }
  let output = {}
  for (let username of user_list) {
    let infolist = await get_collection_for_user(username, 'logs:pages')
    for (let x of infolist) {
      if (x.type != 'click') {
        continue
      }
      let to = x.to
      if (output[to] == null) {
        output[to] = 0
      }
      output[to] += 1
    }
  }
  return output
}

async function get_all_page_views() {
  let user_to_is_logging_enabled = await get_user_to_is_logging_enabled()
  let user_list = []
  for (let username of Object.keys(user_to_is_logging_enabled)) {
    if (user_to_is_logging_enabled[username]) {
      user_list.push(username)
    }
  }
  let output = {}
  for (let username of user_list) {
    let infolist = await get_collection_for_user(username, 'logs:pages')
    for (let x of infolist) {
      let page = x.page
      if (output[page] != null) {
        output[page] = 0
      }
      output[page] += 1
    }
  }
  return output
}

async function get_user_to_session_lengths_with_intervention() {
  let user_to_is_logging_enabled = await get_user_to_is_logging_enabled()
  let user_list = []
  for (let username of Object.keys(user_to_is_logging_enabled)) {
    if (user_to_is_logging_enabled[username]) {
      user_list.push(username)
    }
  }
  let output = {}
  for (let username of user_list) {
    //console.log(username)
    output[username] = await get_session_lengths_with_intervention(username)
  }
  console.log("done")
  return output
  /*
  console.log(user_list)
  console.log(user_list.length)
  let output_list_promises = []
  for (let username of user_list) {
    console.log(username)
    session_lengths_with_intervention_promise = get_session_lengths_with_intervention(username)
    output_list_promises.push(session_lengths_with_intervention_promise)
  }
  console.log('starting promise wait')
  output_list = await Promise.all(output_list_promises)
  let output = {}
  for (let i = 0; i < user_list.length; ++i) {
    let username = user_list[i]
    let session_lengths_with_intervention = output_list[i]
    output[username] = session_lengths_with_intervention
  }
  console.log('done with computation')
  */
  //return output
}

async function get_session_lengths_with_intervention_all_users() {
  username_to_session_lengths_with_intervention = await get_user_to_session_lengths_with_intervention()
  let output = {}
  for (let username of Object.keys(username_to_session_lengths_with_intervention)) {
    let domain_to_intervention_to_session_lengths = username_to_session_lengths_with_intervention[username]
    for (let domain of Object.keys(domain_to_intervention_to_session_lengths)) {
      let intervention_to_session_lengths = domain_to_intervention_to_session_lengths[domain]
      for (let intervention_name of Object.keys(intervention_to_session_lengths)) {
        let session_lengths = intervention_to_session_lengths[intervention_name]
        if (output[domain] == null) {
          output[domain] = {}
        }
        if (output[domain][intervention_name] == null) {
          output[domain][intervention_name] = []
        }
        for (let session_length of session_lengths) {
          output[domain][intervention_name].push(session_length)
        }
      }
    }
  }
  return output
}

async function get_session_lengths_with_intervention_real(user_id) {
  let seconds_on_domain_per_session = await get_collection_for_user(user_id, 'synced:seconds_on_domain_per_session')
  let interventions_active_for_domain_and_session = await get_collection_for_user(user_id, 'synced:interventions_active_for_domain_and_session')
  let domain_to_intervention_to_session_lengths = {}
  let domain_to_session_to_intervention = {}
  for (let x of interventions_active_for_domain_and_session) {
    if (x.val == null) {
      continue
    }
    let interventions_active = JSON.parse(x.val)
    if (interventions_active.length == 0) {
      continue
    }
    let intervention_name = interventions_active[0]
    let domain = x.key
    let session_id = x.key2
    if (!domain_to_session_to_intervention[domain]) {
      domain_to_session_to_intervention[domain] = {}
    }
    domain_to_session_to_intervention[domain][session_id] = intervention_name
  }
  for (let x of seconds_on_domain_per_session) {
    let domain = x.key
    let session_id = x.key2
    let time_spent = x.val
    if (!domain_to_session_to_intervention[domain]) {
      continue
    }
    let intervention_name = domain_to_session_to_intervention[domain][session_id]
    if (!intervention_name) {
      continue
    }
    if (!domain_to_intervention_to_session_lengths[domain]) {
      domain_to_intervention_to_session_lengths[domain] = {}
    }
    if (!domain_to_intervention_to_session_lengths[domain][intervention_name]) {
      domain_to_intervention_to_session_lengths[domain][intervention_name] = []
    }
    domain_to_intervention_to_session_lengths[domain][intervention_name].push(time_spent)
  }
  return domain_to_intervention_to_session_lengths
  /*
  let domain_to_intervention_to_average_session_length = {}
  for (let domain of Object.keys(domain_to_intervention_to_session_lengths)) {
    for (let intervention_name of Object.keys(domain_to_intervention_to_session_lengths[domain])) {
      let session_lengths = domain_to_intervention_to_session_lengths[domain][intervention_name]
      let average_session_length = prelude.average(session_lengths)
      if (!domain_to_intervention_to_average_session_length[domain]) {
        domain_to_intervention_to_average_session_length[domain] = {}
      }
      domain_to_intervention_to_average_session_length[domain][intervention_name] = average_session_length
    }
  }
  */
  //console.log(domain_to_intervention_to_session_lengths)
  //console.log(seconds_on_domain_per_session)
  //console.log(interventions_active_for_domain_and_session)
}

async function get_acceptance_rates() {
  console.log("new")
  let users = await get_all_users_in_experiment_by_name('intervention_suggestion_optout')
  let obj = {}
  for (let user of users)
    obj[user] = true
  let rate = {optout: {},
              optin: {},
              total: {}
            }
  console.log(obj)
  let collections = await listcollections()
  for (let x of collections) {
     let smp = x.split('_')
      if (obj[smp[0]]) {
        let col = await get_collection(x)
        for (let tmp of col) {
          try {
          if (!tmp)
            continue
          
          if (tmp['optout'] || tmp['suggestion_optout']) {
            console.log('optout')
            if (tmp['action'] == 'accepted')
                if (!rate['optout'][tmp['intervention']])
                  rate['optout'][tmp['intervention']] = {suggested:0, rejected:0}
                rate['optout'][tmp['intervention']]['suggested'] += 1
            if (tmp['action'] == 'rejected')
              rate['optout'][tmp['intervention']]['rejected'] += 1
          }
          else if (tmp['type'] == "suggested") {
            console.log('optin')
            if (!rate['optin'][tmp['intervention']]) 
              rate['optin'][tmp['intervention']] = {suggested:0, accepted:0}
            rate['optin'][tmp['intervention']]['suggested'] += 1
          }
          else if (tmp['type'] == 'suggestion_action' && tmp['action'] == 'accepted')
            if (rate['optin'][tmp['intervention']])
              rate['optin'][tmp['intervention']]['accepted'] += 1
            else console.log(tmp)
          }
          catch {
            console.log("why")
            continue
          }
      }
    }
  }
  return rate;

}
let get_session_lengths_with_intervention = memoize_to_disk(get_session_lengths_with_intervention_real)

function printcb(err, result) {
  console.log(err)
  if (result !== undefined) {
    console.log(result)
  }
}

navigator.storage.persist().then(function(x) {
  console.log(x)
})
