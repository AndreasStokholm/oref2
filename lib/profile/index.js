
var basal = require('./basal');
var targets = require('./targets');
var isf = require('./isf');
var carb_ratios = require('./carbs');
var _ = require('lodash');

function defaults ( ) {
  return /* profile */ {
    max_iob: 9 // if max_iob is not provided, will default to zero
    , max_daily_safety_multiplier: 5
    , current_basal_safety_multiplier: 6
    , autosens_max: 2.5
    , autosens_min: 0.5
    , rewind_resets_autosens: true // reset autosensitivity to neutral for awhile after each pump rewind
    // , autosens_adjust_targets: false // when autosens detects sensitivity/resistance, also adjust BG target accordingly
    , high_temptarget_raises_sensitivity: false // raise sensitivity for temptargets >= 101.  synonym for exercise_mode
    , low_temptarget_lowers_sensitivity: false // lower sensitivity for temptargets <= 99.
    , sensitivity_raises_target: false // raise BG target when autosens detects sensitivity
    , resistance_lowers_target: false // lower BG target when autosens detects resistance
    , exercise_mode: false // when true, > 100 mg/dL high temp target adjusts sensitivityRatio for exercise_mode. This majorly changes the behavior of high temp targets from before. synonmym for high_temptarget_raises_sensitivity
    , half_basal_exercise_target: 150 // when temptarget is 160 mg/dL *and* exercise_mode=true, run 50% basal at this level (120 = 75%; 140 = 60%)
    // create maxCOB and default it to 120 because that's the most a typical body can absorb over 4 hours.
    // (If someone enters more carbs or stacks more; OpenAPS will just truncate dosing based on 120.
    // Essentially, this just limits AMA/SMB as a safety cap against excessive COB entry)
    , maxCOB: 120
    , skip_neutral_temps: false // if true, don't set neutral temps
    , unsuspend_if_no_temp: false // if true, pump will un-suspend after a zero temp finishes
    , bolussnooze_dia_divisor: 2 // bolus snooze decays after 1/2 of DIA
    , min_5m_carbimpact: 8 // mg/dL per 5m (8 mg/dL/5m corresponds to 24g/hr at a CSF of 4 mg/dL/g (x/5*60/4))
    , floating_carbs: false // if true, use all entered carbs for predBGs: don't decay them as COB
    , autotune_isf_adjustmentFraction: 1.0 // keep autotune ISF closer to pump ISF via a weighted average of fullNewISF and pumpISF.  1.0 allows full adjustment, 0 is no adjustment from pump ISF.
    , remainingCarbsFraction: 1.0 // fraction of carbs we'll assume will absorb over 4h if we don't yet see carb absorption
    , remainingCarbsCap: 90 // max carbs we'll assume will absorb over 4h if we don't yet see carb absorption
    // WARNING: use SMB with caution: it can and will automatically bolus up to max_iob worth of extra insulin
    , enableUAM: true // enable detection of unannounced meal carb absorption
    , A52_risk_enable: false
    , enableSMB_with_COB: true // enable supermicrobolus while COB is positive
    , enableSMB_with_temptarget: true // enable supermicrobolus for eating soon temp targets
    // *** WARNING *** DO NOT USE enableSMB_always or enableSMB_after_carbs with Libre or similar
    // LimiTTer, etc. do not properly filter out high-noise SGVs.  xDrip+ builds greater than or equal to
    // version number d8e-7097-2018-01-22 provide proper noise values, so that oref0 can ignore high noise
    // readings, and can temporarily raise the BG target when sensor readings have medium noise,
    // resulting in appropriate SMB behaviour.  Older versions of xDrip+ should not be used with enableSMB_always.
    // Using SMB overnight with such data sources risks causing a dangerous overdose of insulin
    // if the CGM sensor reads falsely high and doesn't come down as actual BG does
    , enableSMB_always: true // always enable supermicrobolus (unless disabled by high temptarget)
    , enableSMB_after_carbs: true // enable supermicrobolus for 6h after carbs, even with 0 COB
    // *** WARNING *** DO NOT USE enableSMB_always or enableSMB_after_carbs with Libre or similar.
    , allowSMB_with_high_temptarget: true // allow supermicrobolus (if otherwise enabled) even with high temp targets
    , maxSMBBasalMinutes: 90 // maximum minutes of basal that can be delivered as a single SMB with uncovered COB
    , maxUAMSMBBasalMinutes: 90 // maximum minutes of basal that can be delivered as a single SMB when IOB exceeds COB
    , SMBInterval: 3 // minimum interval between SMBs, in minutes.
    , bolus_increment: 0.05 // minimum bolus that can be delivered as an SMB
    , maxDelta_bg_threshold: 0.2 // maximum change in bg to use SMB, above that will disable SMB
    , curve: "rapid-acting" // change this to "ultra-rapid" for Fiasp, or "bilinear" for old curve
    , useCustomPeakTime: false // allows changing insulinPeakTime
    , insulinPeakTime: 45 // number of minutes after a bolus activity peaks.  defaults to 55m for Fiasp if useCustomPeakTime: false
    , carbsReqThreshold: 1 // grams of carbsReq to trigger a pushover
    , offline_hotspot: false // enabled an offline-only local wifi hotspot if no Internet available
    , noisyCGMTargetMultiplier: 1.3 // increase target by this amount when looping off raw/noisy CGM data
    , suspend_zeros_iob: true // recognize pump suspends as non insulin delivery events
    // send the glucose data to the pump emulating an enlite sensor. This allows to setup high / low warnings when offline and see trend.
    // To enable this feature, enable the sensor, set a sensor with id 0000000, go to start sensor and press find lost sensor.
    , enableEnliteBgproxy: false
    // TODO: make maxRaw a preference here usable by oref0-raw in myopenaps-cgm-loop
    //, maxRaw: 200 // highest raw/noisy CGM value considered safe to use for looping
    , calc_glucose_noise: false
    , target_bg: false // set to an integer value in mg/dL to override pump min_bg
    // autoISF variables
    , use_autoisf: false // Defaults to false. Enable to use autoISF & SMB Range extension.
    , autoisf_hourlychange: 0.2 // rate at which autoISF grows per hour assuming bg is twice target. When value = 1.0, ISF is reduced to 50% after 1 hour of BG at 2x target
    , autoisf_max: 1.5 // Multiplier cap on how high the autoISF ratio can be and therefore how low it can adjust ISF
    , autoisf_min: 1 // This is a multiplier cap for autoISF to set a limit on how low the autoISF ratio can be, which in turn determines how high it can adjust ISF.
    , smb_max_range_extension: 1 //Default value: 1 This is another key OpenAPS safety cap, and specifies by what factor you can exceed the regular 120 maxSMB/maxUAM minutes. Increase this experimental value slowly and with caution.
    , enableautoisf_with_COB: false // Enables autoISF not just for UAM, but also with COB
    , higher_ISFrange_weight: 0  // Default value: 0.0 This is the weight applied to the polygon which adapts ISF if glucose is above target. With 0.0 the effect is effectively disabled.
    , lower_ISFrange_weight: 0 // Default value: 0.0 This is the weight applied to the polygon which adapts ISF if glucose is below target. With 0.0 the effect is effectively disabled.
    , delta_ISFrange_weight: 0 // Default value: 0.0 This is the weight applied to the polygon which adapts ISF higher deltas. With 0.0 the effect is effectively disabled.
    , smb_delivery_ratio_bg_range: 0 // Default value: 0, Sensible is 40. The linearly increasing SMB delivery ratio is mapped to the glucose range [target_bg, target_bg+bg_range]. At target_bg the SMB ratio is smb_delivery_ratio_min, at target_bg+bg_range it is smb_delivery_ratio_max. With 0 the linearly increasing SMB ratio is disabled and the fix smb_delivery_ratio is used.
    , smb_delivery_ratio_min: 0.5 // Default value: 0.5 This is the lower end of a linearly increasing ratio rather than the fix value above.
    , smb_delivery_ratio_max: 0.9 // Default value: 0.9 This is the upper end of a linearly increasing ratio rather than the fix value above.
    , smb_delivery_ratio: 0.5 //Default value: 0.5 Used if flexible delivery ratio is not used. This is another key OpenAPS safety cap, and specifies what share of the total insulin required can be delivered as SMB. This is to prevent people from getting into dangerous territory by setting SMB requests from the caregivers phone at the same time. Increase this experimental value slowly and with caution.
    , postmeal_ISF_weight: 0 // Default value: 0.0 This is the weight applied to the linear slope while glucose rises and  which adapts ISF. With 0.0 this contribution is effectively disabled.
    , postmeal_ISF_duration: 3  // Default value: 3 This is the duration in hours how long after a meal the effect will be active. Oref will delete carb timing after 10 hours latest no matter what you enter.
    , enableppisf_always: false // Enable the postprandial ISF adaptation all the time regardless of when the last meal was taken.
    , enable_BG_acceleration: false //Enable the additional use of autoISF 2.2 BG acceleration adaption
    , bgAccel_ISF_weight: 0 // Default value: 0 This is the weight applied while glucose accelerates and which strengthens ISF. With 0 this contribution is effectively disabled.
    , bgBrake_ISF_weight: 0 // Default value: 0 This is the weight applied while glucose decelerates and which weakens ISF. With 0 this contribution is effectively disabled.
    , adjustmentFactor: 1
    , useNewFormula: false
    , enableDynamicCR: false
    , enableChris: false 
    , weightPercentage: 0.65 
    , tddAdjBasal: false // Enable adjustment of basal based on the ratio of 24 h : 7 day average TDD
    , enableSMB_high_bg: false // enable SMBs when a high BG is detected, based on the high BG target (adjusted or profile)
    , enableSMB_high_bg_target: 110 // set the value enableSMB_high_bg will compare against to enable SMB. If BG > than this value, SMBs should enable.
    , threshold_setting: 0.65 // Use a configurable threshold setting 
  };
}

function displayedDefaults () {
    var allDefaults = defaults();
    var profile = { };

    profile.max_iob = allDefaults.max_iob;
    profile.max_daily_safety_multiplier = allDefaults.max_daily_safety_multiplier;
    profile.current_basal_safety_multiplier= allDefaults.current_basal_safety_multiplier;
    profile.autosens_max = allDefaults.autosens_max;
    profile.autosens_min = allDefaults.autosens_min;
    profile.rewind_resets_autosens = allDefaults.rewind_resets_autosens;
    profile.exercise_mode = allDefaults.exercise_mode;
    profile.sensitivity_raises_target = allDefaults.sensitivity_raises_target;
    profile.unsuspend_if_no_temp = allDefaults.unsuspend_if_no_temp;
    profile.enableSMB_with_COB = allDefaults.enableSMB_with_COB;
    profile.enableSMB_with_temptarget = allDefaults.enableSMB_with_temptarget;
    profile.enableUAM = allDefaults.enableUAM;
    profile.curve = allDefaults.curve;
    profile.offline_hotspot = allDefaults.offline_hotspot;
    profile.bolus_increment = allDefaults.bolus_increment;
    profile.use_autoisf = allDefaults.use_autoisf;
    profile.autoisf_hourlychange = allDefaults.autoisf_hourlychange;
    profile.autoisf_max = allDefaults.autoisf_max;
    profile.autoisf_min = allDefaults.autoisf_min;
    profile.smb_delivery_ratio = allDefaults.smb_delivery_ratio;
    profile.smb_max_range_extension = allDefaults.smb_max_range_extension;
    profile.enableautoisf_with_COB = allDefaults.enableautoisf_with_COB;
    profile.higher_ISFrange_weight = allDefaults.higher_ISFrange_weight;
    profile.lower_ISFrange_weight = allDefaults.lower_ISFrange_weight;
    profile.delta_ISFrange_weight = allDefaults.delta_ISFrange_weight;
    profile.smb_delivery_ratio_bg_range = allDefaults.smb_delivery_ratio_bg_range;
    profile.smb_delivery_ratio_min = allDefaults.smb_delivery_ratio_min;
    profile.smb_delivery_ratio_max = allDefaults.smb_delivery_ratio_max;
    profile.postmeal_ISF_weight = allDefaults.postmeal_ISF_weight;
    profile.postmeal_ISF_duration = allDefaults.postmeal_ISF_duration;
    profile.enableppisf_always = allDefaults.enableppisf_always;
    profile.enable_BG_acceleration = allDefaults.enable_BG_acceleration;
    profile.bgAccel_ISF_weight = allDefaults.bgAccel_ISF_weight;
    profile.bgBrake_ISF_weight = allDefaults.bgBrake_ISF_weight;
    profile.maxDelta_bg_threshold = allDefaults.maxDelta_bg_threshold;
    profile.adjustmentFactor = allDefaults.adjustmentFactor;
    profile.useNewFormula = allDefaults.useNewFormula;
    profile.enableDynamicCR = allDefaults.enableDynamicCR;
    profile.enableChris = allDefaults.enableChris;
    profile.weightPercentage = allDefaults.weightPercentage;
    profile.tddAdjBasal = allDefaults.tddAdjBasal;
    profile.threshold_setting = allDefaults.threshold_setting;

    console.error(profile);
    return profile
}

function generate (inputs, opts) {
  var profile = opts && opts.type ? opts : defaults( );

  // check if inputs has overrides for any of the default prefs
  // and apply if applicable
  for (var pref in profile) {
    if (inputs.hasOwnProperty(pref)) {
      profile[pref] = inputs[pref];
    }
  }

  var pumpsettings_data = inputs.settings;
  if (inputs.settings.insulin_action_curve > 1) {
    profile.dia =  pumpsettings_data.insulin_action_curve;
  } else {
    console.error('DIA of', profile.dia, 'is not supported');
    return -1;
  }

  if (inputs.model) {
    profile.model = inputs.model;
  }
  profile.skip_neutral_temps = inputs.skip_neutral_temps;

  profile.current_basal = basal.basalLookup(inputs.basals);
  profile.basalprofile = inputs.basals;

  _.forEach(profile.basalprofile, function(basalentry) {
    basalentry.rate = +(Math.round(basalentry.rate + "e+3")  + "e-3");
  });

  profile.max_daily_basal = basal.maxDailyBasal(inputs);
  profile.max_basal = basal.maxBasalLookup(inputs);
  if (profile.current_basal === 0) {
    console.error("current_basal of",profile.current_basal,"is not supported");
    return -1;
  }
  if (profile.max_daily_basal === 0) {
    console.error("max_daily_basal of",profile.max_daily_basal,"is not supported");
    return -1;
  }
  if (profile.max_basal < 0.1) {
    console.error("max_basal of",profile.max_basal,"is not supported");
    return -1;
  }

  var range = targets.bgTargetsLookup(inputs, profile);
  profile.out_units = inputs.targets.user_preferred_units;
  profile.min_bg = Math.round(range.min_bg);
  profile.max_bg = Math.round(range.max_bg);
  profile.bg_targets = inputs.targets;

  _.forEach(profile.bg_targets.targets, function(bg_entry) {
    bg_entry.high = Math.round(bg_entry.high);
    bg_entry.low = Math.round(bg_entry.low);
    bg_entry.min_bg = Math.round(bg_entry.min_bg);
    bg_entry.max_bg = Math.round(bg_entry.max_bg);
  });

  delete profile.bg_targets.raw;

  profile.temptargetSet = range.temptargetSet;
  profile.sens = isf.isfLookup(inputs.isf);
  profile.isfProfile = inputs.isf;
  if (profile.sens < 5) {
    console.error("ISF of",profile.sens,"is not supported");
    return -1;
  }
  if (typeof(inputs.carbratio) !== "undefined") {
    profile.carb_ratio = carb_ratios.carbRatioLookup(inputs, profile);
    profile.carb_ratios = inputs.carbratio;
  } else {
    console.error("Profile wasn't given carb ratio data, cannot calculate carb_ratio");
  }
  return profile;
}


generate.defaults = defaults;
generate.displayedDefaults = displayedDefaults;
exports = module.exports = generate;
