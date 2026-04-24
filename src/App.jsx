import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, ReferenceLine, AreaChart, Area
} from 'recharts';
import { Waves, Wind, Hammer, Zap, Move, Activity, Pickaxe,
         GitCommit, Trash2, TrendingUp, AlertTriangle } from 'lucide-react';

// m: metal cost, e: energy build cost, l: buildtime (ticks), o: fixed E/s output,
// xm: metal extraction ratio vs arm T1 mex (0.001 base); variable units have no o/xm
const BAR_STATS = {
  Wind          : { name: 'Arm. Wind Turbine'        , m: 40    , e: 175   , l: 1600    , color: 0x4CAF50, hex: '#4CAF50', tags: ['t1', 'land', 'variable', 'armada'] },
  CorWind       : { name: 'Cor. Wind Turbine'        , m: 43    , e: 175   , l: 1680    , color: 0xEF9A9A, hex: '#EF9A9A', tags: ['t1', 'land', 'variable', 'cortex'] },
  LegWind       : { name: 'Leg. Wind Turbine'        , m: 45    , e: 175   , l: 1680    , color: 0x80CBC4, hex: '#80CBC4', tags: ['t1', 'land', 'variable', 'legion'] },
  Tidal         : { name: 'Arm. Tidal Generator'     , m: 90    , e: 200   , l: 2190    , color: 0x00BCD4, hex: '#00BCD4', tags: ['t1', 'naval', 'variable', 'armada'] },
  CorTidal      : { name: 'Cor. Tidal Generator'     , m: 85    , e: 250   , l: 2100    , color: 0xFFAB91, hex: '#FFAB91', tags: ['t1', 'naval', 'variable', 'cortex'] },
  LegTidal      : { name: 'Leg. Tidal Generator'     , m: 85    , e: 250   , l: 2100    , color: 0x80DEEA, hex: '#80DEEA', tags: ['t1', 'naval', 'variable', 'legion'] },
  Solar         : { name: 'Arm. Solar Collector'     , m: 155   , e: 0     , l: 2600    , o: 20,   color: 0xFDD835, hex: '#FDD835', tags: ['t1', 'land', 'armada'] },
  CorSolar      : { name: 'Cor. Solar Collector'     , m: 150   , e: 0     , l: 2800    , o: 20,   color: 0xEF5350, hex: '#EF5350', tags: ['t1', 'land', 'cortex'] },
  LegSolar      : { name: 'Leg. Solar Collector'     , m: 155   , e: 0     , l: 2800    , o: 20,   color: 0x26C6DA, hex: '#26C6DA', tags: ['t1', 'land', 'legion'] },
  AdvSolar      : { name: 'Arm. Adv. Solar'          , m: 350   , e: 5000  , l: 7950    , o: 80,   color: 0xFF9800, hex: '#FF9800', tags: ['t1', 'land', 'armada'] },
  CorAdvSolar   : { name: 'Cor. Adv. Solar'          , m: 370   , e: 4000  , l: 8150    , o: 80,   color: 0xE53935, hex: '#E53935', tags: ['t1', 'land', 'cortex'] },
  LegAdvSolar   : { name: 'Leg. Adv. Solar'          , m: 465   , e: 4080  , l: 13580   , o: 100,   color: 0x00ACC1, hex: '#00ACC1', tags: ['t1', 'land', 'legion'] },
  Geo           : { name: 'Arm. Geothermal'          , m: 560   , e: 13000 , l: 13100   , o: 300,   color: 0xE91E63, hex: '#E91E63', tags: ['t1', 'land', 'georeq', 'armada'] },
  CorGeo        : { name: 'Cor. Geothermal'          , m: 540   , e: 13000 , l: 12900   , o: 300,   color: 0xC62828, hex: '#C62828', tags: ['t1', 'land', 'georeq', 'cortex'] },
  LegGeo        : { name: 'Leg. Geothermal'          , m: 560   , e: 13000 , l: 12900   , o: 300,   color: 0x00838F, hex: '#00838F', tags: ['t1', 'land', 'georeq', 'legion'] },
  Fusion        : { name: 'Arm. Fusion Reactor'      , m: 3350  , e: 18000 , l: 54000   , o: 750,   color: 0x2196F3, hex: '#2196F3', tags: ['t2', 'land', 'armada'] },
  CorFusion     : { name: 'Cor. Fusion Reactor'      , m: 3600  , e: 22000 , l: 59000   , o: 850,   color: 0xBF360C, hex: '#BF360C', tags: ['t2', 'land', 'cortex'] },
  LegFusion     : { name: 'Leg. Fusion Reactor'      , m: 4000  , e: 25000 , l: 66000   , o: 950,   color: 0x006064, hex: '#006064', tags: ['t2', 'land', 'legion'] },
  AdvGeo        : { name: 'Arm. Adv. Geothermal'     , m: 1600  , e: 27000 , l: 50000   , o: 1250,   color: 0xF44336, hex: '#F44336', tags: ['t2', 'land', 'georeq', 'armada'] },
  CorAdvGeo     : { name: 'Cor. Adv. Geothermal'     , m: 1500  , e: 27000 , l: 48000   , o: 1250,   color: 0xB71C1C, hex: '#B71C1C', tags: ['t2', 'land', 'georeq', 'cortex'] },
  LegAdvGeo     : { name: 'Leg. Adv. Geothermal'     , m: 1600  , e: 27000 , l: 49950   , o: 1250,   color: 0x004D40, hex: '#004D40', tags: ['t2', 'land', 'georeq', 'legion'] },
  UWFusion      : { name: 'Arm. Naval Fusion'        , m: 5200  , e: 33500 , l: 99900   , o: 1200,   color: 0x3F51B5, hex: '#3F51B5', tags: ['t2', 'naval', 'armada'] },
  CorUWFusion   : { name: 'Cor. Naval Fusion'        , m: 5400  , e: 34000 , l: 105000  , o: 1220,   color: 0x880E4F, hex: '#880E4F', tags: ['t2', 'naval', 'cortex'] },
  AFUS          : { name: 'Arm. Adv. Fusion'         , m: 9700  , e: 69000 , l: 312500  , o: 3000,   color: 0x9C27B0, hex: '#9C27B0', tags: ['t2', 'land', 'armada'] },
  CorAFUS       : { name: 'Cor. Adv. Fusion'         , m: 9700  , e: 48000 , l: 329200  , o: 3000,   color: 0x4A148C, hex: '#4A148C', tags: ['t2', 'land', 'cortex'] },
  LegAFUS       : { name: 'Leg. Adv. Fusion'         , m: 10500 , e: 69000 , l: 340000  , o: 3300,   color: 0x1B5E20, hex: '#1B5E20', tags: ['t2', 'land', 'legion'] },

  Mex           : { name: 'Arm. T1 Mex'              , m: 50    , e: 500   , l: 1800    , xm: 1.0, color: 0xFFD54F, hex: '#FFD54F', tags: ['t1', 'land', 'mex', 'armada'] },
  CorMex        : { name: 'Cor. T1 Mex'              , m: 50    , e: 500   , l: 1870    , xm: 1.0, color: 0xFFCA28, hex: '#FFCA28', tags: ['t1', 'land', 'mex', 'cortex'] },
  LegMex        : { name: 'Leg. T1 Mex'              , m: 50    , e: 500   , l: 1880    , xm: 0.8, o: 7, color: 0xD4E157, hex: '#D4E157', tags: ['t1', 'land', 'mex', 'legion'] },
  LegMexT15     : { name: 'Leg. T1.5 Mex'            , m: 250   , e: 5000  , l: 5000    , xm: 2.0, color: 0xAFB42B, hex: '#AFB42B', tags: ['t1', 'land', 'mex', 'legion'] },
  Moho          : { name: 'Arm. Moho Mex'            , m: 620   , e: 7700  , l: 14900   , xm: 4.0, color: 0xFF8F00, hex: '#FF8F00', tags: ['t2', 'land', 'mex', 'armada'] },
  CorMoho       : { name: 'Cor. Moho Mex'            , m: 640   , e: 8100  , l: 14100   , xm: 4.0, color: 0xF57C00, hex: '#F57C00', tags: ['t2', 'land', 'mex', 'cortex'] },
  LegMoho       : { name: 'Leg. Moho Mex'            , m: 640   , e: 8100  , l: 14100   , xm: 4.0, color: 0x827717, hex: '#827717', tags: ['t2', 'land', 'mex', 'legion'] },

  EStor         : { name: 'Arm. Energy Storage'      , m: 170   , e: 1700  , l: 4110    , eStore: 6000, color: 0x78909C, hex: '#78909C', tags: ['t1', 'land', 'estor', 'armada'] },
  CorEStor      : { name: 'Cor. Energy Storage'      , m: 175   , e: 1800  , l: 4260    , eStore: 6000, color: 0x546E7A, hex: '#546E7A', tags: ['t1', 'land', 'estor', 'cortex'] },
  LegEStor      : { name: 'Leg. Energy Storage'      , m: 175   , e: 1800  , l: 4260    , eStore: 6000, color: 0x455A64, hex: '#455A64', tags: ['t1', 'land', 'estor', 'legion'] },
  MStor         : { name: 'Arm. Metal Storage'       , m: 330   , e: 570   , l: 2920    , mStore: 3000, color: 0x8D6E63, hex: '#8D6E63', tags: ['t1', 'land', 'mstor', 'armada'] },
  CorMStor      : { name: 'Cor. Metal Storage'       , m: 340   , e: 590   , l: 2920    , mStore: 3000, color: 0x795548, hex: '#795548', tags: ['t1', 'land', 'mstor', 'cortex'] },
  LegMStor      : { name: 'Leg. Metal Storage'       , m: 340   , e: 590   , l: 2920    , mStore: 3000, color: 0x4E342E, hex: '#4E342E', tags: ['t1', 'land', 'mstor', 'legion'] },

  ConK          : { name: 'Arm. Con. Kbot'           , m: 110   , e: 1600  , l: 3450    , bp: 80, color: 0xFF7043, hex: '#FF7043', tags: ['t1', 'land', 'constructor', 'armada'] },
  CorConK       : { name: 'Cor. Con. Kbot'           , m: 120   , e: 1750  , l: 3550    , bp: 85, color: 0xFF8A65, hex: '#FF8A65', tags: ['t1', 'land', 'constructor', 'cortex'] },
  LegConK       : { name: 'Leg. Con. Kbot'           , m: 100   , e: 1600  , l: 3250    , bp: 75, color: 0xFFA726, hex: '#FFA726', tags: ['t1', 'land', 'constructor', 'legion'] },
  ConV          : { name: 'Arm. Con. Vehicle'        , m: 135   , e: 1950  , l: 4050    , bp: 90, color: 0xFF5722, hex: '#FF5722', tags: ['t1', 'land', 'constructor', 'armada'] },
  CorConV       : { name: 'Cor. Con. Vehicle'        , m: 145   , e: 2100  , l: 4160    , bp: 95, color: 0xFF6E40, hex: '#FF6E40', tags: ['t1', 'land', 'constructor', 'cortex'] },
  LegConV       : { name: 'Leg. Con. Vehicle'        , m: 125   , e: 2100  , l: 3900    , bp: 85, color: 0xFB8C00, hex: '#FB8C00', tags: ['t1', 'land', 'constructor', 'legion'] },
  ConKT2        : { name: 'Arm. T2 Con. Kbot'        , m: 430   , e: 6900  , l: 12500   , bp: 210, color: 0xE64A19, hex: '#E64A19', tags: ['t2', 'land', 'constructor', 'armada'] },
  CorConKT2     : { name: 'Cor. T2 Con. Kbot'        , m: 470   , e: 6900  , l: 12500   , bp: 220, color: 0xFF3D00, hex: '#FF3D00', tags: ['t2', 'land', 'constructor', 'cortex'] },
  LegConKT2     : { name: 'Leg. T2 Con. Kbot'        , m: 410   , e: 6900  , l: 9300    , bp: 195, color: 0xF57C00, hex: '#F57C00', tags: ['t2', 'land', 'constructor', 'legion'] },
  ConVT2        : { name: 'Arm. T2 Con. Vehicle'     , m: 550   , e: 6800  , l: 16000   , bp: 290, color: 0xBF360C, hex: '#BF360C', tags: ['t2', 'land', 'constructor', 'armada'] },
  CorConVT2     : { name: 'Cor. T2 Con. Vehicle'     , m: 580   , e: 7000  , l: 17000   , bp: 310, color: 0xDD2C00, hex: '#DD2C00', tags: ['t2', 'land', 'constructor', 'cortex'] },
  LegConVT2     : { name: 'Leg. T2 Con. Vehicle'     , m: 530   , e: 6600  , l: 11900   , bp: 270, color: 0xEF6C00, hex: '#EF6C00', tags: ['t2', 'land', 'constructor', 'legion'] },
  ConA          : { name: 'Arm. Con. Aircraft'       , m: 110   , e: 3000  , l: 7960    , bp: 60, color: 0x29B6F6, hex: '#29B6F6', tags: ['t1', 'air', 'constructor', 'armada'] },
  CorConA       : { name: 'Cor. Con. Aircraft'       , m: 115   , e: 3200  , l: 8360    , bp: 65, color: 0x0288D1, hex: '#0288D1', tags: ['t1', 'air', 'constructor', 'cortex'] },
  LegConA       : { name: 'Leg. Con. Aircraft'       , m: 105   , e: 3200  , l: 7560    , bp: 55, color: 0x01579B, hex: '#01579B', tags: ['t1', 'air', 'constructor', 'legion'] },
  Nano          : { name: 'Arm. Nano Turret'         , m: 230   , e: 3200  , l: 5300    , bp: 200, color: 0x5C6BC0, hex: '#5C6BC0', tags: ['t1', 'land', 'nanolathe', 'armada'] },
  CorNano       : { name: 'Cor. Nano Turret'         , m: 230   , e: 3200  , l: 5300    , bp: 200, color: 0x7E57C2, hex: '#7E57C2', tags: ['t1', 'land', 'nanolathe', 'cortex'] },
  LegNano       : { name: 'Leg. Nano Turret'         , m: 230   , e: 3200  , l: 5300    , bp: 200, color: 0xAB47BC, hex: '#AB47BC', tags: ['t1', 'land', 'nanolathe', 'legion'] },
  Butler        : { name: 'Arm. Butler'              , m: 210   , e: 3000  , l: 6000    , bp: 140, color: 0xF48FB1, hex: '#F48FB1', tags: ['t2', 'land', 'constructor', 'armada'] },
  CorTwitcher   : { name: 'Cor. Twitcher'            , m: 210   , e: 3800  , l: 8000    , bp: 125, color: 0xCE93D8, hex: '#CE93D8', tags: ['t2', 'land', 'constructor', 'cortex'] },
  LegFastCon    : { name: 'Leg. Combat Engineer'     , m: 1240  , e: 22400 , l: 38000   , bp: 600, color: 0xA5D6A7, hex: '#A5D6A7', tags: ['t2', 'land', 'constructor', 'legion'] },
  Consul        : { name: 'Arm. Consul'              , m: 250   , e: 4300  , l: 8500    , bp: 150, color: 0x9575CD, hex: '#9575CD', tags: ['t2', 'land', 'constructor', 'armada'] },
  CorConsul     : { name: 'Cor. Consul'              , m: 330   , e: 4700  , l: 12500   , bp: 200, color: 0xEC407A, hex: '#EC407A', tags: ['t2', 'land', 'constructor', 'cortex'] },
  LegConsul     : { name: 'Leg. Consul'              , m: 200   , e: 2900  , l: 4000    , bp: 120, color: 0x00E5FF, hex: '#00E5FF', tags: ['t2', 'land', 'constructor', 'legion'] },

  T1Lab         : { name: 'Arm. Bot Lab'             , m: 500   , e: 950   , l: 5000    , bp: 150, color: 0x7CB342, hex: '#7CB342', tags: ['t1', 'land', 'factory', 'armada'] },
  CorT1Lab      : { name: 'Cor. Bot Lab'             , m: 470   , e: 1050  , l: 5000    , bp: 150, color: 0x9CCC65, hex: '#9CCC65', tags: ['t1', 'land', 'factory', 'cortex'] },
  LegT1Lab      : { name: 'Leg. Bot Lab'             , m: 470   , e: 1050  , l: 5000    , bp: 150, color: 0xAED581, hex: '#AED581', tags: ['t1', 'land', 'factory', 'legion'] },
  T1Veh         : { name: 'Arm. Vehicle Plant'       , m: 590   , e: 1550  , l: 5700    , bp: 150, color: 0xF57F17, hex: '#F57F17', tags: ['t1', 'land', 'factory', 'armada'] },
  CorT1Veh      : { name: 'Cor. Vehicle Plant'       , m: 570   , e: 1550  , l: 5650    , bp: 150, color: 0xF9A825, hex: '#F9A825', tags: ['t1', 'land', 'factory', 'cortex'] },
  LegT1Veh      : { name: 'Leg. Vehicle Plant'       , m: 570   , e: 1650  , l: 5700    , bp: 150, color: 0xFFE082, hex: '#FFE082', tags: ['t1', 'land', 'factory', 'legion'] },
  T1Air         : { name: 'Arm. Aircraft Plant'      , m: 650   , e: 1100  , l: 5450    , bp: 150, color: 0x0277BD, hex: '#0277BD', tags: ['t1', 'land', 'factory', 'armada'] },
  CorT1Air      : { name: 'Cor. Aircraft Plant'      , m: 630   , e: 1100  , l: 5380    , bp: 150, color: 0x039BE5, hex: '#039BE5', tags: ['t1', 'land', 'factory', 'cortex'] },
  LegT1Air      : { name: 'Leg. Aircraft Plant'      , m: 430   , e: 1100  , l: 6380    , bp: 150, color: 0x4FC3F7, hex: '#4FC3F7', tags: ['t1', 'land', 'factory', 'legion'] },
  T1Hover       : { name: 'Arm. Hover Platform'      , m: 670   , e: 2000  , l: 8700    , bp: 150, color: 0x00695C, hex: '#00695C', tags: ['t1', 'land', 'factory', 'armada'] },
  CorT1Hover    : { name: 'Cor. Hover Platform'      , m: 670   , e: 2000  , l: 8700    , bp: 150, color: 0x007986, hex: '#007986', tags: ['t1', 'land', 'factory', 'cortex'] },
  LegT1Hover    : { name: 'Leg. Hover Platform'      , m: 670   , e: 2000  , l: 8700    , bp: 150, color: 0x4DB6AC, hex: '#4DB6AC', tags: ['t1', 'land', 'factory', 'legion'] },
  T2Lab         : { name: 'Arm. Adv. Bot Lab'        , m: 2600  , e: 15000 , l: 25000   , bp: 600, color: 0x558B2F, hex: '#558B2F', tags: ['t2', 'land', 'factory', 'armada'] },
  CorT2Lab      : { name: 'Cor. Adv. Bot Lab'        , m: 2600  , e: 16000 , l: 26000   , bp: 600, color: 0x689F38, hex: '#689F38', tags: ['t2', 'land', 'factory', 'cortex'] },
  LegT2Lab      : { name: 'Leg. Adv. Bot Lab'        , m: 2600  , e: 16000 , l: 25200   , bp: 600, color: 0x33691E, hex: '#33691E', tags: ['t2', 'land', 'factory', 'legion'] },
  T2Veh         : { name: 'Arm. Adv. Vehicle Plant'  , m: 2600  , e: 14000 , l: 27000   , bp: 600, color: 0x6D4C41, hex: '#6D4C41', tags: ['t2', 'land', 'factory', 'armada'] },
  CorT2Veh      : { name: 'Cor. Adv. Vehicle Plant'  , m: 2600  , e: 16000 , l: 28000   , bp: 600, color: 0x5D4037, hex: '#5D4037', tags: ['t2', 'land', 'factory', 'cortex'] },
  LegT2Veh      : { name: 'Leg. Adv. Vehicle Plant'  , m: 2500  , e: 16000 , l: 27750   , bp: 600, color: 0x3E2723, hex: '#3E2723', tags: ['t2', 'land', 'factory', 'legion'] },
  T2Air         : { name: 'Arm. Adv. Aircraft Plant' , m: 2900  , e: 29000 , l: 32000   , bp: 600, color: 0x1565C0, hex: '#1565C0', tags: ['t2', 'land', 'factory', 'armada'] },
  CorT2Air      : { name: 'Cor. Adv. Aircraft Plant' , m: 2900  , e: 28000 , l: 32000   , bp: 600, color: 0x0D47A1, hex: '#0D47A1', tags: ['t2', 'land', 'factory', 'cortex'] },
  LegT2Air      : { name: 'Leg. Adv. Aircraft Plant' , m: 2900  , e: 28000 , l: 31050   , bp: 600, color: 0x1A237E, hex: '#1A237E', tags: ['t2', 'land', 'factory', 'legion'] },
};

// Tag definitions — label shown in UI, desc for tooltip
const TAGS = {
  armada:      { label: 'Armada',      desc: 'Armada faction' },
  cortex:      { label: 'Cortex',      desc: 'Cortex faction' },
  legion:      { label: 'Legion',      desc: 'Legion faction' },
  t1:          { label: 'T1',          desc: 'Tier 1 structures' },
  t2:          { label: 'T2',          desc: 'Tier 2 structures' },
  land:        { label: 'Land',        desc: 'Buildable on land' },
  naval:       { label: 'Naval',       desc: 'Buildable on water' },
  air:         { label: 'Air',         desc: 'Construction aircraft' },
  variable:    { label: 'Variable',    desc: 'Output depends on map conditions' },
  georeq:      { label: 'Geo Vent',    desc: 'Requires a geothermal vent' },
  mex:         { label: 'Mex',         desc: 'Metal extractor (uses spot value slider)' },
  estor:       { label: 'E-Storage',   desc: 'Energy storage building (increases E cap in waterfall)' },
  mstor:       { label: 'M-Storage',   desc: 'Metal storage building (increases M cap in waterfall)' },
  constructor: { label: 'Constructor', desc: 'Mobile builder (adds BP on completion in waterfall)' },
  nanolathe:   { label: 'Nanolathe',   desc: 'Stationary construction turret (adds BP on completion in waterfall)' },
  factory:     { label: 'Factory',     desc: 'Production lab or plant (adds BP on completion in waterfall)' },
};

const CYCLE = { null: 'yes', yes: 'no', no: null };

const passesFilter = (unit, tagFilters) =>
  Object.entries(tagFilters).every(([tag, state]) => {
    if (!state) return true;
    return state === 'yes' ? unit.tags.includes(tag) : !unit.tags.includes(tag);
  });

const M_TO_E = 70;
const MIN_BP = 80;
const MAX_BP = 40000;
const MAX_ROI_SLICE = 600;

const M_INC_MIN = 0.1,  M_INC_MAX = 1000;
const E_INC_MIN = 1,    E_INC_MAX = 100000;
const logToMInc = v => v <= 0 ? 0 : Math.exp(Math.log(M_INC_MIN) + (v/100)*(Math.log(M_INC_MAX)-Math.log(M_INC_MIN)));
const mIncToLog = v => v <= 0 ? 0 : 100*(Math.log(Math.max(M_INC_MIN,v))-Math.log(M_INC_MIN))/(Math.log(M_INC_MAX)-Math.log(M_INC_MIN));
const logToEInc = v => v <= 0 ? 0 : Math.exp(Math.log(E_INC_MIN) + (v/100)*(Math.log(E_INC_MAX)-Math.log(E_INC_MIN)));
const eIncToLog = v => v <= 0 ? 0 : 100*(Math.log(Math.max(E_INC_MIN,v))-Math.log(E_INC_MIN))/(Math.log(E_INC_MAX)-Math.log(E_INC_MIN));

const M_STORE_MIN = 100,    M_STORE_MAX = 50000;
const E_STORE_MIN = 100,    E_STORE_MAX = 1000000;
const logToMStore = v => v <= 0 ? 0 : Math.exp(Math.log(M_STORE_MIN) + (v/100)*(Math.log(M_STORE_MAX)-Math.log(M_STORE_MIN)));
const mStoreToLog = v => v <= 0 ? 0 : 100*(Math.log(Math.max(M_STORE_MIN,v))-Math.log(M_STORE_MIN))/(Math.log(M_STORE_MAX)-Math.log(M_STORE_MIN));
const logToEStore = v => v <= 0 ? 0 : Math.exp(Math.log(E_STORE_MIN) + (v/100)*(Math.log(E_STORE_MAX)-Math.log(E_STORE_MIN)));
const eStoreToLog = v => v <= 0 ? 0 : 100*(Math.log(Math.max(E_STORE_MIN,v))-Math.log(E_STORE_MIN))/(Math.log(E_STORE_MAX)-Math.log(E_STORE_MIN));

// Decompose unit income into independent metal and energy streams.
// metalIncome: M/s (mexes only); energyIncome: E/s (generators + Legion mex bonus).
const getIncomeStreams = (s, wind, tidal, spotValue) => {
  const metalIncome = s.xm ? s.xm * spotValue : 0;
  let energyIncome;
  if (s.xm != null) {
    energyIncome = s.o ?? 0;                          // Legion T1 mex has a bonus E/s
  } else if (s.tags.includes('variable')) {
    energyIncome = Math.max(0.1, s.tags.includes('naval') ? tidal : wind);
  } else {
    energyIncome = s.o ?? 0;
  }
  return { metalIncome, energyIncome };
};

// ROI frames:
//   unified  — platonic: full cost vs combined income, nomBP assumed (mInc/eInc ignored)
//   energy   — full E cost vs energy income, nomBP assumed (M budget infinite)
//   metal    — full M cost vs metal income, nomBP assumed (E budget infinite)
//   economy  — income-capped effective BP: your income rate determines max sustainable
//              build speed per unit. effectiveBP = min(nomBP, mInc*l/m, eInc*l/e).
//              At the sustainable rate income exactly covers cost, so ROI → buildTime.
const computeROI = (s, wind, tidal, spotValue, bp, roiFrame, mInc = 0, eInc = 0) => {
  const nomBP = Math.max(MIN_BP, bp);
  const { metalIncome, energyIncome } = getIncomeStreams(s, wind, tidal, spotValue);

  if (roiFrame === 'economy') {
    const sustM  = (s.m > 0 && mInc > 0) ? mInc * s.l / s.m : (s.m > 0 ? MIN_BP : nomBP);
    const sustE  = (s.e > 0 && eInc > 0) ? eInc * s.l / s.e : (s.e > 0 ? MIN_BP : nomBP);
    const effBP  = Math.max(MIN_BP, Math.min(nomBP, sustM, sustE));
    const buildT = s.l / effBP;
    const netM   = Math.max(0, s.m - mInc * buildT);
    const netE   = Math.max(0, s.e - eInc * buildT);
    const income = metalIncome * M_TO_E + energyIncome;
    return income < 0.01 ? Infinity : buildT + (netM * M_TO_E + netE) / income;
  }

  const buildT = s.l / nomBP;
  switch (roiFrame) {
    case 'unified': {
      const income = metalIncome * M_TO_E + energyIncome;
      return income < 0.01 ? Infinity : buildT + (s.m * M_TO_E + s.e) / income;
    }
    case 'energy':
      return energyIncome < 0.01 ? Infinity : buildT + s.e / energyIncome;
    case 'metal':
      return metalIncome < 0.01 ? Infinity : buildT + s.m / metalIncome;
    default: return Infinity;
  }
};

// X-axis ranges for the 3D manifold's configurable free axis (linear mapping in 3D).
const AXIS_RANGES = { wind: 20, tidal: 30, spot: 10, mInc: M_INC_MAX, eInc: E_INC_MAX };

const logToBp = (val) => Math.exp(Math.log(MIN_BP) + (val / 100) * (Math.log(MAX_BP) - Math.log(MIN_BP)));
const bpToLog = (bp) => 100 * (Math.log(Math.max(MIN_BP, bp)) - Math.log(MIN_BP)) / (Math.log(MAX_BP) - Math.log(MIN_BP));

const TAG_STYLES = {
  yes: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
  no:  'bg-red-500/20 border-red-500/40 text-red-400 line-through',
  null:'bg-slate-800/60 border-white/10 text-slate-500',
};

const TagFilter = ({ tagFilters, onToggle }) => (
  <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5">
    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Unit Filter</p>
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(TAGS).map(([tag, { label, desc }]) => {
        const state = tagFilters[tag] ?? null;
        return (
          <button
            key={tag}
            title={desc}
            onClick={() => onToggle(tag)}
            className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider transition-all duration-150 ${TAG_STYLES[state ?? 'null']}`}
          >
            {state === 'yes' && '✓ '}{state === 'no' && '✗ '}{label}
          </button>
        );
      })}
    </div>
  </div>
);

const ThreeDScene = ({ wind, tidal, bp, activeKeys, spotValue, roiFrame, freeAxis, simulatedBP, mInc, eInc }) => {
  const mountRef = useRef(null);
  const propsRef = useRef({ wind, tidal, bp, activeKeys, spotValue, roiFrame, freeAxis, simulatedBP, mInc, eInc });

  useEffect(() => {
    propsRef.current = { wind, tidal, bp, activeKeys, spotValue, roiFrame, freeAxis, simulatedBP, mInc, eInc };
  }, [wind, tidal, bp, activeKeys, spotValue, roiFrame, freeAxis, simulatedBP, mInc, eInc]);

  useEffect(() => {
    if (!mountRef.current) return;
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050810);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(12, 10, 12);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const grid = new THREE.GridHelper(20, 20, 0x1e293b, 0x0f172a);
    grid.position.y = 10;
    scene.add(grid);

    const markerSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 })
    );
    scene.add(markerSphere);

    const size = 20;
    const segments = 45;
    const surfaces = {};

    Object.entries(BAR_STATS).forEach(([key, s]) => {
      const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
      const material = new THREE.MeshPhongMaterial({
        color: s.color, side: THREE.DoubleSide, transparent: true, opacity: 0.35, shininess: 40
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      scene.add(mesh);
      surfaces[key] = mesh;
    });

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(10, 20, 10);
    scene.add(pointLight);

    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const { wind: wVal, tidal: tVal, bp: bpVal, activeKeys: ak,
              spotValue: sv, roiFrame: frame, freeAxis: fa, simulatedBP: simBP,
              mInc: mI, eInc: eI } = propsRef.current;
      // Mode 3: marker moves to simulated BP position when a build queue is active.
      const markerBP = (simBP && simBP !== bpVal) ? simBP : bpVal;
      const xRange = AXIS_RANGES[fa] ?? 20;
      const freeAxisToVal = t => fa === 'mInc' ? logToMInc(t * 100)
        : fa === 'eInc' ? logToEInc(t * 100)
        : t * xRange;
      const valToFreeAxis = v => fa === 'mInc' ? mIncToLog(v) / 100
        : fa === 'eInc' ? eIncToLog(v) / 100
        : v / xRange;

      Object.entries(surfaces).forEach(([key, mesh]) => {
        const s = BAR_STATS[key];
        mesh.visible = ak.has(key);
        if (!mesh.visible) return;

        const positions = mesh.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
          const xPos = positions[i];
          const yPos = positions[i + 1];
          const xVal = freeAxisToVal((xPos + 10) / 20);
          const curBP = Math.exp(((yPos + 10) / 20) * (Math.log(MAX_BP) - Math.log(MIN_BP)) + Math.log(MIN_BP));
          const windC  = fa === 'wind'  ? xVal : wVal;
          const tidalC = fa === 'tidal' ? xVal : tVal;
          const spotC  = fa === 'spot'  ? xVal : sv;
          const mIncC  = fa === 'mInc'  ? xVal : mI;
          const eIncC  = fa === 'eInc'  ? xVal : eI;
          const roi = computeROI(s, windC, tidalC, spotC, curBP, frame, mIncC, eIncC);
          positions[i + 2] = 10 - Math.min((isFinite(roi) ? roi : 1300) / 50, 25);
        }
        mesh.geometry.attributes.position.needsUpdate = true;
      });

      // Marker sphere: sit at current slider value on the free axis
      const markerAxisVal = fa === 'wind' ? wVal : fa === 'tidal' ? tVal
        : fa === 'spot' ? sv : fa === 'mInc' ? mI : fa === 'eInc' ? eI : sv;
      const mX = valToFreeAxis(markerAxisVal) * 20 - 10;
      const bpForMapping = Math.max(MIN_BP, markerBP);
      const mYPos = ((Math.log(bpForMapping) - Math.log(MIN_BP)) / (Math.log(MAX_BP) - Math.log(MIN_BP))) * 20 - 10;
      let bestROI = Infinity;
      ak.forEach(k => {
        const r = computeROI(BAR_STATS[k], wVal, tVal, sv, bpForMapping, frame, mI, eI);
        if (isFinite(r) && r < bestROI) bestROI = r;
      });

      markerSphere.position.set(mX, 10 - (bestROI / 50), -mYPos);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (mountRef.current && renderer.domElement) mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full rounded-xl overflow-hidden cursor-crosshair" />;
};

const SLICE_AXIS_CFG = {
  bp:    { label: 'Build Power (BP)',  range: [MIN_BP, MAX_BP],        scale: 'log',    fmt: v => v >= 1000 ? Math.round(v/1000)+'k' : Math.round(v) },
  wind:  { label: 'Wind Speed (m/s)', range: [0, 20],                  scale: 'linear', fmt: v => v.toFixed(0) },
  tidal: { label: 'Tidal Speed (m/s)',range: [0, 30],                  scale: 'linear', fmt: v => v.toFixed(0) },
  spot:  { label: 'Metal Spot (M/s)', range: [0, 10],                  scale: 'linear', fmt: v => v.toFixed(1) },
  mInc:  { label: 'M-Income (M/s)',   range: [M_INC_MIN, M_INC_MAX],  scale: 'log',    fmt: v => v >= 10 ? Math.round(v)+'M/s' : v.toFixed(1) },
  eInc:  { label: 'E-Income (E/s)',   range: [E_INC_MIN, E_INC_MAX],  scale: 'log',    fmt: v => v >= 1000 ? Math.round(v/1000)+'k' : Math.round(v) },
  queue: { label: 'Game Time (s)',     range: [0, 1],                   scale: 'linear', fmt: v => Math.round(v)+'s' },
};

const ROI_FRAME_LABELS = {
  unified: 'Platonic ROI (s)',
  energy:  'E-Payback (s)',
  metal:   'M-Payback (s)',
  economy: 'Economy ROI (s)',
};

const SliceView = ({ wind, tidal, bp, activeKeys, markers, spotValue, roiFrame, sliceAxis, simulatedBP, mInc, eInc, simulation }) => {
  const isQueue = sliceAxis === 'queue' && simulation != null;
  const queueRange = isQueue ? [0, simulation.totalTime] : null;
  const axisCfg = isQueue
    ? { ...SLICE_AXIS_CFG.queue, range: queueRange }
    : SLICE_AXIS_CFG[sliceAxis];

  const data = useMemo(() => {
    const steps = 80;
    if (isQueue) {
      const { econSnapshots, totalTime } = simulation;
      return Array.from({ length: steps + 1 }, (_, i) => {
        const xVal = (i / steps) * totalTime;
        let snap = econSnapshots[0];
        for (const s of econSnapshots) { if (s.atTime <= xVal) snap = s; else break; }
        const point = { x: xVal };
        activeKeys.forEach(key => {
          const roi = computeROI(BAR_STATS[key], wind, tidal, spotValue, snap.bp, roiFrame, snap.mInc, snap.eInc);
          point[key] = isFinite(roi) ? Math.min(roi, MAX_ROI_SLICE + 100) : MAX_ROI_SLICE + 100;
        });
        return point;
      });
    }
    return Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      const [lo, hi] = axisCfg.range;
      const xVal = sliceAxis === 'bp' ? logToBp(t * 100)
        : axisCfg.scale === 'log' ? Math.exp(Math.log(lo) + t * (Math.log(hi) - Math.log(lo)))
        : lo + t * (hi - lo);
      const windC  = sliceAxis === 'wind'  ? xVal : wind;
      const tidalC = sliceAxis === 'tidal' ? xVal : tidal;
      const spotC  = sliceAxis === 'spot'  ? xVal : spotValue;
      const bpC    = sliceAxis === 'bp'    ? xVal : bp;
      const mIncC  = sliceAxis === 'mInc'  ? xVal : mInc;
      const eIncC  = sliceAxis === 'eInc'  ? xVal : eInc;
      const point  = { x: xVal };
      activeKeys.forEach(key => {
        const roi = computeROI(BAR_STATS[key], windC, tidalC, spotC, bpC, roiFrame, mIncC, eIncC);
        point[key] = isFinite(roi) ? Math.min(roi, MAX_ROI_SLICE + 100) : MAX_ROI_SLICE + 100;
      });
      return point;
    });
  }, [wind, tidal, bp, activeKeys, spotValue, roiFrame, sliceAxis, mInc, eInc, simulation, isQueue]);

  const yLabel = ROI_FRAME_LABELS[roiFrame] ?? 'ROI (s)';

  const refLineVal = isQueue ? null
    : sliceAxis === 'bp'    ? bp
    : sliceAxis === 'wind'  ? wind
    : sliceAxis === 'tidal' ? tidal
    : sliceAxis === 'spot'  ? spotValue
    : sliceAxis === 'mInc'  ? Math.max(M_INC_MIN, mInc)
    : Math.max(E_INC_MIN, eInc);
  // Mode 3: when a build queue exists, show a second line at the simulated final BP.
  const simRefLine = (sliceAxis === 'bp' && simulatedBP && simulatedBP !== bp) ? simulatedBP : null;

  return (
    <div className="w-full h-full p-4 bg-slate-950 flex flex-col">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="x" type="number"
              domain={axisCfg.range} scale={axisCfg.scale} stroke="#64748b"
              label={{ value: axisCfg.label, position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 10 }}
              tick={{ fontSize: 10 }} tickFormatter={axisCfg.fmt}
            />
            <YAxis
              reversed domain={[0, MAX_ROI_SLICE]} allowDataOverflow stroke="#64748b"
              label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
              tick={{ fontSize: 10 }} ticks={[0, 100, 200, 300, 400, 500, 600]}
            />
            <RechartsTooltip
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
              labelFormatter={(v) => `${axisCfg.label}: ${axisCfg.fmt(v)}`}
              itemStyle={{ fontSize: '11px' }}
              formatter={(value) => [value > MAX_ROI_SLICE ? '∞' : value.toFixed(1) + 's', yLabel]}
            />
            <Legend verticalAlign="top" iconType="circle" wrapperStyle={{ fontSize: '10px', paddingBottom: '20px' }} />
            {[...activeKeys].map(key => {
              const s = BAR_STATS[key];
              return (
                <Line key={key} type="monotone" dataKey={key} name={s.name} stroke={s.hex}
                  dot={false} strokeWidth={2} activeDot={{ r: 4 }} isAnimationActive={false} />
              );
            })}
            {refLineVal != null && (
              <ReferenceLine x={refLineVal} stroke="#ffffff" strokeDasharray="5 5"
                label={{ value: simRefLine ? 'Now' : 'You', fill: '#fff', fontSize: 10, position: 'top' }} />
            )}
            {simRefLine && (
              <ReferenceLine x={simRefLine} stroke="#34d399" strokeWidth={2}
                label={{ value: 'After', fill: '#34d399', fontSize: 10, position: 'top' }} />
            )}
            {isQueue && simulation.econSnapshots.slice(1).map((snap, i) => (
              <ReferenceLine key={i} x={snap.atTime} stroke="#1e3a5f" strokeDasharray="2 2"
                label={{ value: BAR_STATS[snap.key]?.name.split(' ').pop() ?? '', fill: '#334155', fontSize: 7, position: 'top' }} />
            ))}
            {sliceAxis === 'bp' && markers.map(m => (
              <ReferenceLine key={m.label} x={m.val} stroke="#334155" strokeDasharray="2 2"
                label={{ value: m.label, fill: '#475569', fontSize: 8, position: 'bottom' }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Horizontal scrolling unit picker sorted by economy ROI — the primary construction tool.
const ConstructionPicker = ({ activeKeys, wind, tidal, spotValue, bp, mInc, eInc, buildOrder, addToBuildOrder, setBuildOrder }) => {
  const econSorted = useMemo(() => {
    return [...activeKeys].map(key => {
      const s = BAR_STATS[key];
      const roi = computeROI(s, wind, tidal, spotValue, bp, 'economy', mInc, eInc);
      return { key, ...s, roi };
    }).sort((a, b) => (isFinite(a.roi) ? a.roi : Infinity) - (isFinite(b.roi) ? b.roi : Infinity));
  }, [activeKeys, wind, tidal, spotValue, bp, mInc, eInc]);

  const shortName = name => name
    .replace(/^(?:Arm\.|Cor\.|Leg\.)\s*/, '')
    .replace(/^Adv\.\s*/, '+ ');

  return (
    <div className="shrink-0 border-b border-white/5 bg-slate-950 backdrop-blur">
      <div className="flex items-center justify-between px-4 pt-2 pb-0.5">
        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
          <Zap size={8} className="text-yellow-700" /> Build Queue · Economy Sort
        </span>
        {buildOrder.length > 0 && (
          <button onClick={() => setBuildOrder([])}
            className="text-[8px] font-black uppercase tracking-widest text-slate-600 hover:text-red-400 flex items-center gap-1 transition-colors">
            <Trash2 size={8} /> Clear ({buildOrder.length})
          </button>
        )}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-2 px-4 pt-1" style={{ scrollbarWidth: 'none' }}
        onWheel={e => { e.preventDefault(); e.currentTarget.scrollLeft += e.deltaY; }}>
        {econSorted.length === 0 ? (
          <p className="text-[9px] text-slate-700 py-2">No units match filters.</p>
        ) : econSorted.map((item, i) => {
          const finite = isFinite(item.roi);
          const isTop = i === 0 && finite;
          return (
            <button key={item.key}
              onClick={() => addToBuildOrder(item.key)}
              title={`${item.name} · Economy ROI: ${finite ? Math.round(item.roi)+'s' : '∞'} · click to queue`}
              className={`flex-shrink-0 w-[76px] rounded-lg px-2 py-1.5 border text-left transition-all hover:scale-105 active:scale-95
                ${isTop
                  ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                  : 'border-white/8 bg-slate-900/60 hover:border-white/20 hover:bg-slate-800/60'}`}>
              <div className="flex items-center gap-1 mb-0.5">
                <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-px" style={{ backgroundColor: item.hex }} />
                <span className="text-[7px] font-black uppercase truncate leading-tight"
                  style={{ color: isTop ? item.hex : '#64748b' }}>
                  {shortName(item.name)}
                </span>
              </div>
              <span className={`font-mono text-[9px] font-bold block ${isTop ? 'text-emerald-400' : finite ? 'text-slate-500' : 'text-slate-700'}`}>
                {finite ? Math.round(item.roi)+'s' : '∞'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Simulation computed at App level; drag-and-drop reorder via HTML5 DnD API.
const WaterfallView = ({ buildOrder, simulation, removeStep, reorderBuildOrder, onApplyToManifold }) => {
  const dragIdx = useRef(null);
  const [dropTarget, setDropTarget] = useState(null);

  const handleDrop = (toIdx) => {
    if (dragIdx.current === null || dragIdx.current === toIdx) return;
    const next = [...buildOrder];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(toIdx, 0, moved);
    reorderBuildOrder(next);
    dragIdx.current = null;
    setDropTarget(null);
  };

  return (
    <div className="w-full h-full p-4 bg-slate-950 flex flex-col gap-3 overflow-hidden">

      {/* ── Simulation ─────────────────────────────────────────────── */}
      {!simulation ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <GitCommit size={36} className="text-slate-700 mb-3 animate-pulse" />
          <p className="text-slate-600 text-xs max-w-xs leading-relaxed italic">
            Use the <span className="text-slate-400 font-bold not-italic">+</span> buttons in the Payback Velocity list to queue units — the simulation tracks resource flow and stall risk.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 bg-slate-900/50 rounded-2xl border border-white/5 p-4 flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2 flex-wrap">
              <TrendingUp size={12} /> Resource Flow
              <span className="font-mono text-slate-600 normal-case tracking-normal">
                · {simulation.totalTime}s · BP&nbsp;<span className="text-purple-400">{simulation.finalBP}</span>
                · E {simulation.finalPE.toFixed(1)}/s · M {simulation.finalPM.toFixed(2)}/s
              </span>
            </h4>
            <div className="flex items-center gap-2 shrink-0">
              {simulation.hadStall && (
                <div className="flex items-center gap-1.5 text-red-400 bg-red-500/10 px-2 py-1 rounded border border-red-500/20 animate-pulse">
                  <AlertTriangle size={10} />
                  <span className="text-[9px] font-bold uppercase">Stall</span>
                </div>
              )}
              <button onClick={onApplyToManifold}
                className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded text-[9px] font-black uppercase text-emerald-400 hover:bg-emerald-500/20 transition-all">
                <Activity size={10} /> → Manifold
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={simulation.points} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradM" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradE" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 9 }} tickFormatter={v => v + 's'} />
                <YAxis stroke="#64748b" tick={{ fontSize: 9 }} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '10px' }}
                  labelFormatter={v => `t = ${v}s`}
                  formatter={(v, name) => [v.toFixed(0), name]}
                />
                <Area type="monotone" dataKey="metal" stroke="#94a3b8" fill="url(#gradM)"
                  name="Metal" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Area type="monotone" dataKey="energy" stroke="#fbbf24" fill="url(#gradE)"
                  name="Energy" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Step queue (drag-to-reorder) ─────────────────────────── */}
      {buildOrder.length > 0 && (
        <div className="h-[80px] flex gap-2 overflow-x-auto shrink-0 py-1" style={{ scrollbarWidth: 'none' }}
          onWheel={(e) => { e.currentTarget.scrollLeft += e.deltaY; }}>
          {buildOrder.map((step, idx) => {
            const s = BAR_STATS[step.key];
            const isTarget = dropTarget === idx;
            return (
              <div key={step.id}
                draggable
                onDragStart={() => { dragIdx.current = idx; }}
                onDragOver={(e) => { e.preventDefault(); setDropTarget(idx); }}
                onDragLeave={() => setDropTarget(null)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={() => { dragIdx.current = null; setDropTarget(null); }}
                className={`flex-shrink-0 w-28 rounded-xl p-2 flex flex-col justify-between relative cursor-grab active:cursor-grabbing select-none transition-all
                  ${isTarget
                    ? 'bg-emerald-500/10 border border-emerald-500/50 scale-105'
                    : 'bg-slate-900 border border-white/10'}`}
              >
                <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Step {idx + 1}</span>
                <span className="text-[9px] font-black uppercase truncate leading-tight" style={{ color: s.hex }}>{s.name}</span>
                {/* X always visible inside card bounds — not clipped by overflow-x-auto */}
                <button
                  onClick={(e) => { e.stopPropagation(); removeStep(idx); }}
                  className="absolute top-1.5 right-1.5 bg-red-500/60 hover:bg-red-500 text-white rounded-full p-0.5 transition-colors"
                >
                  <Trash2 size={7} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const App = () => {
  const [wind, setWind] = useState(8);
  const [bp, setBP] = useState(300);
  const [tidal, setTidal] = useState(20);
  const [spotValue, setSpotValue] = useState(1.8);
  const [viewMode, setViewMode] = useState('2d');
  const [roiFrame, setRoiFrame] = useState('unified');
  const [freeAxis3d, setFreeAxis3d] = useState('wind');
  const [sliceAxis, setSliceAxis] = useState('bp');
  const [tagFilters, setTagFilters] = useState(Object.fromEntries(Object.keys(TAGS).map(k => [k, null])));

  // Waterfall / build order state
  const [buildOrder, setBuildOrder] = useState([]);
  const [mInc, setMInc] = useState(2.0);
  const [eInc, setEInc] = useState(25);
  const [mMax, setMMax] = useState(1000);   // storage cap
  const [eMax, setEMax] = useState(1000);
  const [mStart, setMStart] = useState(1000); // starting reserve (≤ mMax)
  const [eStart, setEStart] = useState(1000);
  const nextBOId = useRef(0);

  const addToBuildOrder = (key) => {
    setBuildOrder(prev => [...prev, { key, id: nextBOId.current++ }]);
  };
  const removeFromBuildOrder = (idx) => {
    setBuildOrder(prev => prev.filter((_, i) => i !== idx));
  };
  const reorderBuildOrder = (newOrder) => setBuildOrder(newOrder);

  const toggleTag = (tag) =>
    setTagFilters(prev => ({ ...prev, [tag]: CYCLE[prev[tag] ?? 'null'] }));

  const DEFAULT_FILTERS = Object.fromEntries(Object.keys(TAGS).map(k => [k, null]));
  const resetAll = () => {
    setWind(8); setTidal(20); setSpotValue(1.8); setBP(300);
    setRoiFrame('unified'); setFreeAxis3d('wind'); setSliceAxis('bp');
    setTagFilters(DEFAULT_FILTERS);
    setBuildOrder([]);
    setMInc(2.0); setEInc(25); setMMax(1000); setEMax(1000); setMStart(1000); setEStart(1000);
  };

  const activeKeys = useMemo(() =>
    new Set(Object.keys(BAR_STATS).filter(k => passesFilter(BAR_STATS[k], tagFilters))),
    [tagFilters]
  );

  // Simulation lifted to App level so SliceView and ThreeDScene can read finalBP live.
  // econSnapshots: economy state at each step — used by the queue axis in SliceView.
  const simulation = useMemo(() => {
    if (buildOrder.length === 0) return null;
    let curBP = Math.max(MIN_BP, bp);
    let curEMax = eMax, curMMax = mMax;
    let cm = Math.min(mStart, curMMax), ce = Math.min(eStart, curEMax), time = 0;
    let pM = mInc, pE = eInc;
    let hadStall = false;
    const points = [{ time: 0, metal: parseFloat(cm.toFixed(1)), energy: parseFloat(ce.toFixed(1)) }];
    const econSnapshots = [{ atTime: 0, bp: curBP, mInc: pM, eInc: pE, key: null }];
    for (const step of buildOrder) {
      const s = BAR_STATS[step.key];
      const nomDur = s.l / curBP;
      const mdR = nomDur > 0 ? s.m / nomDur : 0;
      const edR = nomDur > 0 ? s.e / nomDur : 0;
      let workRem = s.l;
      while (workRem > 0 && time < 1800) {
        time++;
        let eff = 1.0;
        if (cm <= 0 && mdR > 0 && pM < mdR) eff = Math.min(eff, pM / mdR);
        if (ce <= 0 && edR > 0 && pE < edR) eff = Math.min(eff, pE / edR);
        if (eff < 1.0) hadStall = true;
        cm = Math.max(0, Math.min(curMMax, cm + pM - mdR * eff));
        ce = Math.max(0, Math.min(curEMax, ce + pE - edR * eff));
        workRem -= curBP * eff;
        if (workRem <= 0) {
          const { metalIncome, energyIncome } = getIncomeStreams(s, wind, tidal, spotValue);
          pM += metalIncome; pE += energyIncome;
          if (s.bp)     curBP   += s.bp;
          if (s.eStore) curEMax += s.eStore;
          if (s.mStore) curMMax += s.mStore;
          econSnapshots.push({ atTime: time, bp: curBP, mInc: pM, eInc: pE, key: step.key });
        }
        if (time % 5 === 0 || workRem <= 0)
          points.push({ time, metal: parseFloat(cm.toFixed(1)), energy: parseFloat(ce.toFixed(1)), stall: eff < 1.0 });
      }
    }
    return { points, hadStall, totalTime: time, econSnapshots,
             finalBP: curBP, finalEMax: curEMax, finalMMax: curMMax,
             finalM: cm, finalE: ce, finalPM: pM, finalPE: pE };
  }, [buildOrder, wind, tidal, bp, spotValue, mInc, eInc, mMax, eMax, mStart, eStart]);

  // Live economy — always reflects the current end-state of the build queue.
  // When no queue, these equal the slider values (initial conditions).
  const liveBP   = simulation?.finalBP  ?? bp;
  const liveMInc = simulation?.finalPM  ?? mInc;
  const liveEInc = simulation?.finalPE  ?? eInc;
  const liveMMax = simulation?.finalMMax ?? mMax;
  const liveEMax = simulation?.finalEMax ?? eMax;

  // Commit build queue: make final state the new initial conditions, clear queue.
  const applyToManifold = () => {
    if (!simulation) return;
    setBP(simulation.finalBP);
    setMInc(parseFloat(simulation.finalPM.toFixed(2)));
    setEInc(parseFloat(simulation.finalPE.toFixed(1)));
    setMMax(simulation.finalMMax);
    setEMax(simulation.finalEMax);
    setMStart(Math.round(simulation.finalM));
    setEStart(Math.round(simulation.finalE));
    setBuildOrder([]);
    setRoiFrame('economy');
    setViewMode('2d');
    setSliceAxis('bp');
  };

  // Payback Velocity — sorted by current ROI frame using live economy values.
  const currentStats = useMemo(() => {
    return [...activeKeys].map(key => {
      const s = BAR_STATS[key];
      const roi = computeROI(s, wind, tidal, spotValue, liveBP, roiFrame, liveMInc, liveEInc);
      return { key, ...s, roi };
    }).sort((a, b) => (isFinite(a.roi) ? a.roi : Infinity) - (isFinite(b.roi) ? b.roi : Infinity));
  }, [activeKeys, wind, tidal, spotValue, liveBP, roiFrame, liveMInc, liveEInc]);

  // If the build queue is cleared, fall back from queue axis automatically.
  const effectiveSliceAxis = sliceAxis === 'queue' && buildOrder.length === 0 ? 'bp' : sliceAxis;

  const markers = [
    { label: 'T1 Bot', val: 80 },
    { label: 'Commander', val: 300 },
    { label: '4 Nanos', val: 800 },
    { label: 'T2 Trans', val: 3000 },
    { label: 'Peak Ind.', val: 20000 },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-black text-slate-100 font-sans">
      <div className="flex flex-col lg:flex-row h-screen overflow-hidden">

        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <div className="w-full lg:w-80 bg-slate-900 border-r border-white/10 px-4 py-4 flex flex-col gap-3 overflow-y-auto z-20 shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-black italic tracking-tighter bg-gradient-to-br from-white to-slate-500 bg-clip-text text-transparent uppercase">
                ROI Manifold
              </h1>
              <p className="text-[8px] text-slate-600 uppercase tracking-widest font-bold">Industrial Analysis v8.0</p>
            </div>
            <button onClick={resetAll}
              className="text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 border border-white/10 px-2 py-1 rounded-lg transition-colors">
              Reset
            </button>
          </div>

          {/* View Selection */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">View Selection</p>
            <div className="bg-slate-900/60 border border-white/5 p-1 rounded-lg flex gap-1">
              {[
                { id: '2d',        icon: <Activity size={12} />, label: '2D Slice' },
                { id: 'waterfall', icon: <GitCommit size={12} />, label: 'Waterfall' },
                { id: '3d',        icon: <Move size={12} />,     label: '3D Manifold' },
              ].map(({ id, icon, label }) => (
                <button key={id} onClick={() => setViewMode(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md transition-all text-[9px] font-black uppercase tracking-wider
                    ${viewMode === id ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                  {icon}<span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ROI Frame + Axis */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5 space-y-3">
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">ROI Frame</p>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { id: 'unified', label: 'Infinite' },
                  { id: 'energy',  label: 'E∞' },
                  { id: 'metal',   label: 'M∞' },
                  { id: 'economy', label: 'Economy' },
                ].map(({ id, label }) => (
                  <button key={id} onClick={() => setRoiFrame(id)}
                    title={{ unified:'Platonic ROI — full cost vs output, infinite resources assumed', energy:'Energy cost & income only (infinite metal budget)', metal:'Metal cost & income only (infinite energy budget)', economy:'Income-capped effective BP: your M/E income rate sets max sustainable build speed per unit' }[id]}
                    className={`py-1 rounded-md text-[9px] font-black uppercase tracking-wider border transition-all
                      ${roiFrame === id ? 'bg-white/10 border-white/20 text-white' : 'border-white/5 text-slate-500 hover:text-slate-300'}`}
                  >{label}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                {viewMode === '3d' ? '3D Free Axis' : viewMode === '2d' ? '2D X Axis' : 'Axis'}
              </p>
              <div className="flex flex-wrap gap-1">
                {(viewMode === '3d'
                  ? [{ id: 'wind', l: 'Wind' }, { id: 'tidal', l: 'Tidal' }, { id: 'spot', l: 'Spot' }, { id: 'mInc', l: 'M/s' }, { id: 'eInc', l: 'E/s' }]
                  : [
                      { id: 'bp',    l: 'BP' },
                      { id: 'wind',  l: 'Wind' },
                      { id: 'tidal', l: 'Tidal' },
                      { id: 'spot',  l: 'Spot' },
                      { id: 'mInc',  l: 'M/s' },
                      { id: 'eInc',  l: 'E/s' },
                      ...(buildOrder.length > 0 ? [{ id: 'queue', l: 'Queue' }] : []),
                    ]
                ).map(({ id, l }) => {
                  const cur = viewMode === '3d' ? freeAxis3d : effectiveSliceAxis;
                  const set = viewMode === '3d' ? setFreeAxis3d : setSliceAxis;
                  return (
                    <button key={id} onClick={() => set(id)}
                      title={id === 'queue' ? 'ROI trajectory along your planned build order' : undefined}
                      className={`flex-1 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border transition-all
                        ${cur === id
                          ? id === 'queue'
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                          : 'border-white/5 text-slate-500 hover:text-slate-300'}`}
                    >{l}</button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Map Conditions */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5 space-y-3">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Map Conditions</p>
            {[
              { label: 'Wind',       icon: <Wind size={11}/>,    val: wind,      set: setWind,      min:0, max:20, step:1,   fmt: v => v+' m/s',         color:'text-emerald-400', accent:'accent-emerald-500' },
              { label: 'Tidal',      icon: <Waves size={11}/>,   val: tidal,     set: setTidal,     min:0, max:30, step:1,   fmt: v => v+' m/s',         color:'text-cyan-400',    accent:'accent-cyan-500' },
              { label: 'Metal Spot', icon: <Pickaxe size={11}/>, val: spotValue, set: setSpotValue, min:0, max:10, step:0.1, fmt: v => v.toFixed(1)+' M/s', color:'text-amber-400',   accent:'accent-amber-500' },
            ].map(({ label, icon, val, set, min, max, step, fmt, color, accent }) => (
              <div key={label}>
                <div className="flex justify-between items-center mb-1.5">
                  <div className={`flex items-center gap-1.5 ${color}`}>{icon}<span className="text-[10px] font-bold uppercase tracking-wider">{label}</span></div>
                  <span className="font-mono text-[11px] text-white">{fmt(val)}</span>
                </div>
                <input type="range" min={min} max={max} step={step} value={val}
                  onChange={e => set(Number(e.target.value))}
                  className={`w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer ${accent}`} />
              </div>
            ))}
          </div>

          {/* Player Economy */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5 space-y-3">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Player Economy</p>
            {/* Build Power */}
            <div>
              <div className="flex justify-between items-center mb-1.5 text-purple-400">
                <div className="flex items-center gap-1.5"><Hammer size={11}/><span className="text-[10px] font-bold uppercase tracking-wider">Build Power</span></div>
                <span className="font-mono text-[11px] text-white">{Math.round(bp)} BP</span>
              </div>
              <div className="relative h-5 flex items-center mb-5 mt-2">
                <input type="range" min="0" max="100" step="0.1"
                  value={bpToLog(bp)} onChange={e => setBP(logToBp(Number(e.target.value)))}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500 z-10" />
                {markers.map(m => (
                  <div key={m.label} className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${bpToLog(m.val)}%` }}>
                    <div className="w-px h-full bg-white/20" />
                    <span className="absolute -bottom-4 left-0 -translate-x-1/2 text-[6px] text-slate-600 font-bold whitespace-nowrap">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* M-Income */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-1.5 text-amber-400"><Pickaxe size={11}/><span className="text-[10px] font-bold uppercase tracking-wider">M-Income</span></div>
                <span className="font-mono text-[11px] text-white">{mInc <= 0 ? '0' : mInc >= 10 ? Math.round(mInc) : mInc.toFixed(1)} M/s</span>
              </div>
              <input type="range" min="0" max="100" step="0.5" value={mIncToLog(mInc)}
                onChange={e => setMInc(logToMInc(Number(e.target.value)))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500" />
            </div>
            {/* E-Income */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-1.5 text-yellow-400"><Zap size={11}/><span className="text-[10px] font-bold uppercase tracking-wider">E-Income</span></div>
                <span className="font-mono text-[11px] text-white">{eInc <= 0 ? '0' : eInc >= 1000 ? (eInc/1000).toFixed(1)+'k' : Math.round(eInc)} E/s</span>
              </div>
              <input type="range" min="0" max="100" step="0.5" value={eIncToLog(eInc)}
                onChange={e => setEInc(logToEInc(Number(e.target.value)))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
            </div>
          </div>

          {/* Starting Resources */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5 space-y-3">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Starting Resources</p>
            {/* Metal */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-amber-300"><Pickaxe size={10}/><span className="text-[9px] font-bold uppercase tracking-wider">Metal</span></div>
                <span className="font-mono text-[10px] text-white">
                  {mStart >= 1000 ? (mStart/1000).toFixed(1)+'k' : mStart} / {mMax >= 1000 ? (mMax/1000).toFixed(1)+'k' : mMax} M
                </span>
              </div>
              <div className="flex gap-1.5 items-center">
                <span className="text-[7px] text-slate-600 uppercase w-6 shrink-0">cap</span>
                <input type="range" min="0" max="100" step="0.5" value={mStoreToLog(mMax)}
                  onChange={e => { const v = Math.round(logToMStore(Number(e.target.value))); setMMax(v); setMStart(s => Math.min(s, v)); }}
                  className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400" />
              </div>
              <div className="flex gap-1.5 items-center">
                <span className="text-[7px] text-slate-600 uppercase w-6 shrink-0">fill</span>
                <input type="range" min="0" max="100" step="0.5" value={mStoreToLog(mStart)}
                  onChange={e => setMStart(Math.min(Math.round(logToMStore(Number(e.target.value))), mMax))}
                  className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-300" />
              </div>
            </div>
            {/* Energy */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-yellow-300"><Zap size={10}/><span className="text-[9px] font-bold uppercase tracking-wider">Energy</span></div>
                <span className="font-mono text-[10px] text-white">
                  {eStart >= 1000 ? (eStart/1000).toFixed(1)+'k' : eStart} / {eMax >= 1000 ? (eMax/1000).toFixed(1)+'k' : eMax} E
                </span>
              </div>
              <div className="flex gap-1.5 items-center">
                <span className="text-[7px] text-slate-600 uppercase w-6 shrink-0">cap</span>
                <input type="range" min="0" max="100" step="0.5" value={eStoreToLog(eMax)}
                  onChange={e => { const v = Math.round(logToEStore(Number(e.target.value))); setEMax(v); setEStart(s => Math.min(s, v)); }}
                  className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-400" />
              </div>
              <div className="flex gap-1.5 items-center">
                <span className="text-[7px] text-slate-600 uppercase w-6 shrink-0">fill</span>
                <input type="range" min="0" max="100" step="0.5" value={eStoreToLog(eStart)}
                  onChange={e => setEStart(Math.min(Math.round(logToEStore(Number(e.target.value))), eMax))}
                  className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-300" />
              </div>
            </div>
          </div>

          {/* Current Economy — live state after build queue */}
          {simulation && (
            <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/20 space-y-2">
              <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Current Economy</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: 'BP', val: Math.round(liveBP), color: 'text-purple-400' },
                  { label: 'M/s', val: liveMInc >= 10 ? Math.round(liveMInc) : liveMInc.toFixed(1), color: 'text-amber-400' },
                  { label: 'E/s', val: liveEInc >= 1000 ? (liveEInc/1000).toFixed(1)+'k' : Math.round(liveEInc), color: 'text-yellow-400' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="bg-slate-900/60 rounded-lg p-1.5 text-center">
                    <p className="text-[7px] text-slate-600 uppercase tracking-widest">{label}</p>
                    <p className={`font-mono text-[11px] font-bold ${color}`}>{val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payback Velocity */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5 space-y-1.5">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Zap size={9} className="text-yellow-700" /> Payback Velocity
            </p>
            {currentStats.length === 0 ? (
              <p className="text-[10px] text-slate-700">No units match filters.</p>
            ) : currentStats.map((item, i) => {
              const finite = isFinite(item.roi);
              const isTop = i === 0 && finite;
              return (
                <div key={item.key}
                  className={`flex items-center gap-2 rounded-lg border transition-all
                    ${isTop ? 'bg-white/5 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.06)]' : 'border-white/5 opacity-60'}`}>
                  <div className="flex-1 flex items-center gap-1.5 min-w-0 px-2 py-1.5">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.hex }} />
                    <span className={`text-[10px] font-bold truncate ${isTop ? 'text-white' : 'text-slate-500'}`}>{item.name}</span>
                  </div>
                  <span className={`font-mono text-[10px] shrink-0 pr-2 ${finite ? (isTop ? 'text-emerald-400' : 'text-slate-500') : 'text-slate-700'}`}>
                    {finite ? Math.round(item.roi)+'s' : '∞'}
                  </span>
                </div>
              );
            })}
          </div>

        </div>

        {/* ── Viewport ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Unit filter */}
          <div className="shrink-0 px-4 pt-3 pb-2 bg-slate-950/90 border-b border-white/5 backdrop-blur">
            <TagFilter tagFilters={tagFilters} onToggle={toggleTag} />
          </div>

          {/* Construction picker — horizontal scrolling, always economy-sorted by live economy */}
          <ConstructionPicker
            activeKeys={activeKeys} wind={wind} tidal={tidal} spotValue={spotValue}
            bp={liveBP} mInc={liveMInc} eInc={liveEInc}
            buildOrder={buildOrder} addToBuildOrder={addToBuildOrder} setBuildOrder={setBuildOrder}
          />

          {/* Main view — all manifold components use live economy (simulation final state when queue exists) */}
          <div className="flex-1 overflow-hidden">
            {viewMode === '3d' && (
              <ThreeDScene wind={wind} tidal={tidal} bp={liveBP} activeKeys={activeKeys}
                spotValue={spotValue} roiFrame={roiFrame} freeAxis={freeAxis3d}
                simulatedBP={null} mInc={liveMInc} eInc={liveEInc} />
            )}
            {viewMode === '2d' && (
              <SliceView wind={wind} tidal={tidal} bp={liveBP} activeKeys={activeKeys}
                markers={markers} spotValue={spotValue} roiFrame={roiFrame} sliceAxis={effectiveSliceAxis}
                simulatedBP={null} mInc={liveMInc} eInc={liveEInc} simulation={simulation} />
            )}
            {viewMode === 'waterfall' && (
              <WaterfallView
                buildOrder={buildOrder} simulation={simulation}
                removeStep={removeFromBuildOrder} reorderBuildOrder={reorderBuildOrder}
                onApplyToManifold={applyToManifold}
              />
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

export default App;
