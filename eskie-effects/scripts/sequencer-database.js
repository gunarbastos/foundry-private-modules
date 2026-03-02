import { MODULE_NAME } from './settings.js';

export const database = {};

export async function createDatabase(moduleFolder) {

    const path = `${moduleFolder}/${MODULE_NAME}/assets`;

    database._templates = { 
    // Grid size, start point, end point
    default: [100, 0, 0],
    ranged: [200, 200, 200],
    line: [200, 200, 200],
    };
    //--------------------
    //ATTACK
    //--------------------
    database.attack = {
        melee: {
            generic: {
                '01': {
                    bludgeoning: {
                        heavy: {
                            blue: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Blue_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Blue_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Blue_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Blue_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Blue_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Blue_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Blue_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Blue_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Blue_Slow_03.webm`,
                                },
                            },
                            green: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Green_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Green_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Green_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Green_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Green_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Green_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Green_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Green_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Green_Slow_03.webm`,
                                },
                            },
                            orange: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Orange_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Orange_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Orange_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Orange_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Orange_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Orange_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Orange_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Orange_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Orange_Slow_03.webm`,
                                },
                            },
                            purple: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Purple_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Purple_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Purple_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Purple_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Purple_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Purple_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Purple_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Purple_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Purple_Slow_03.webm`,
                                },
                            },
                            red: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Red_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Red_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Red_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Red_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Red_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Red_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Red_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Red_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Red_Slow_03.webm`,
                                },
                            },
                            yellow: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Yellow_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Yellow_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Yellow_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Yellow_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Yellow_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Yellow_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Yellow_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Yellow_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_Yellow_Slow_03.webm`,
                                },
                            },
                            purpleblack: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_PurpleBlack_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_PurpleBlack_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_PurpleBlack_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_PurpleBlack_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_PurpleBlack_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_PurpleBlack_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_PurpleBlack_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_PurpleBlack_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_PurpleBlack_Slow_03.webm`,
                                },
                            },
                            redblack: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_RedBlack_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_RedBlack_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_RedBlack_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_RedBlack_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_RedBlack_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_RedBlack_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_RedBlack_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_RedBlack_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Heavy/Attack_Melee_Generic_01_Bludgeoning_Heavy_RedBlack_Slow_03.webm`,
                                },
                            },
                        },
                        light: {
                            blue: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Blue_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Blue_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Blue_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Blue_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Blue_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Blue_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Blue_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Blue_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Blue_Slow_03.webm`,
                                },
                            },
                            green: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Green_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Green_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Green_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Green_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Green_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Green_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Green_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Green_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Green_Slow_03.webm`,
                                },
                            },
                            orange: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Orange_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Orange_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Orange_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Orange_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Orange_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Orange_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Orange_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Orange_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Orange_Slow_03.webm`,
                                },
                            },
                            purple: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Purple_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Purple_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Purple_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Purple_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Purple_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Purple_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Purple_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Purple_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Purple_Slow_03.webm`,
                                },
                            },
                            red: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Red_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Red_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Red_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Red_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Red_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Red_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Red_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Red_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Red_Slow_03.webm`,
                                },
                            },
                            yellow: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Yellow_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Yellow_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Yellow_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Yellow_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Yellow_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Yellow_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Yellow_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Yellow_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_Yellow_Slow_03.webm`,
                                },
                            },
                            purpleblack: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_PurpleBlack_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_PurpleBlack_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_PurpleBlack_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_PurpleBlack_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_PurpleBlack_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_PurpleBlack_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_PurpleBlack_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_PurpleBlack_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_PurpleBlack_Slow_03.webm`,
                                },
                            },
                            redblack: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_RedBlack_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_RedBlack_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_RedBlack_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_RedBlack_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_RedBlack_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_RedBlack_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_RedBlack_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_RedBlack_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Light/Attack_Melee_Generic_01_Bludgeoning_Light_RedBlack_Slow_03.webm`,
                                },
                            },
                        },
                        medium: {
                            blue: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Blue_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Blue_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Blue_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Blue_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Blue_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Blue_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Blue_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Blue_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Blue_Slow_03.webm`,
                                },
                            },
                            green: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Green_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Green_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Green_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Green_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Green_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Green_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Green_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Green_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Green_Slow_03.webm`,
                                },
                            },
                            orange: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Orange_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Orange_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Orange_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Orange_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Orange_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Orange_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Orange_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Orange_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Orange_Slow_03.webm`,
                                },
                            },
                            purple: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Purple_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Purple_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Purple_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Purple_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Purple_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Purple_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Purple_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Purple_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Purple_Slow_03.webm`,
                                },
                            },
                            red: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Red_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Red_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Red_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Red_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Red_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Red_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Red_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Red_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Red_Slow_03.webm`,
                                },
                            },
                            yellow: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Yellow_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Yellow_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Yellow_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Yellow_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Yellow_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Yellow_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Yellow_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Yellow_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_Yellow_Slow_03.webm`,
                                },
                            },
                            purpleblack: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_PurpleBlack_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_PurpleBlack_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_PurpleBlack_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_PurpleBlack_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_PurpleBlack_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_PurpleBlack_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_PurpleBlack_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_PurpleBlack_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_PurpleBlack_Slow_03.webm`,
                                },
                            },
                            redblack: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_RedBlack_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_RedBlack_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_RedBlack_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_RedBlack_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_RedBlack_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_RedBlack_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_RedBlack_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_RedBlack_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Bludgeoning/Medium/Attack_Melee_Generic_01_Bludgeoning_Medium_RedBlack_Slow_03.webm`,
                                },
                            },
                        },
                    },
                    piercing: {
                        heavy: {
                            blue: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Blue_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Blue_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Blue_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Blue_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Blue_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Blue_Slow_02.webm`,
                                },
                            },
                            green: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Green_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Green_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Green_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Green_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Green_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Green_Slow_02.webm`,
                                },
                            },
                            orange: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Orange_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Orange_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Orange_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Orange_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Orange_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Orange_Slow_02.webm`,
                                },
                            },
                            purple: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Purple_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Purple_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Purple_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Purple_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Purple_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Purple_Slow_02.webm`,
                                },
                            },
                            red: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Red_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Red_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Red_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Red_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Red_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Red_Slow_02.webm`,
                                },
                            },
                            yellow: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Yellow_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Yellow_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Yellow_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Yellow_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Yellow_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_Yellow_Slow_02.webm`,
                                },
                            },
                            purpleblack: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_PurpleBlack_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_PurpleBlack_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_PurpleBlack_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_PurpleBlack_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_PurpleBlack_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_PurpleBlack_Slow_02.webm`,
                                },
                            },
                            redblack: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_RedBlack_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_RedBlack_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_RedBlack_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_RedBlack_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_RedBlack_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Heavy/Attack_Melee_Generic_01_Piercing_Heavy_RedBlack_Slow_02.webm`,
                                },
                            },
                        },
                        light: {
                            blue: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Blue_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Blue_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Blue_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Blue_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Blue_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Blue_Slow_02.webm`,
                                },
                            },
                            green: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Green_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Green_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Green_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Green_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Green_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Green_Slow_02.webm`,
                                },
                            },
                            orange: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Orange_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Orange_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Orange_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Orange_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Orange_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Orange_Slow_02.webm`,
                                },
                            },
                            purple: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Purple_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Purple_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Purple_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Purple_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Purple_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Purple_Slow_02.webm`,
                                },
                            },
                            red: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Red_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Red_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Red_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Red_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Red_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Red_Slow_02.webm`,
                                },
                            },
                            yellow: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Yellow_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Yellow_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Yellow_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Yellow_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Yellow_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_Yellow_Slow_02.webm`,
                                },
                            },
                            purpleblack: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_PurpleBlack_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_PurpleBlack_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_PurpleBlack_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_PurpleBlack_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_PurpleBlack_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_PurpleBlack_Slow_02.webm`,
                                },
                            },
                            redblack: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_RedBlack_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_RedBlack_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_RedBlack_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_RedBlack_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_RedBlack_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Light/Attack_Melee_Generic_01_Piercing_Light_RedBlack_Slow_02.webm`,
                                },
                            },
                        },
                        medium: {
                            blue: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Blue_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Blue_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Blue_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Blue_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Blue_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Blue_Slow_02.webm`,
                                },
                            },
                            green: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Green_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Green_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Green_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Green_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Green_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Green_Slow_02.webm`,
                                },
                            },
                            orange: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Orange_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Orange_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Orange_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Orange_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Orange_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Orange_Slow_02.webm`,
                                },
                            },
                            purple: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Purple_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Purple_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Purple_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Purple_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Purple_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Purple_Slow_02.webm`,
                                },
                            },
                            red: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Red_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Red_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Red_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Red_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Red_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Red_Slow_02.webm`,
                                },
                            },
                            yellow: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Yellow_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Yellow_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Yellow_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Yellow_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Yellow_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_Yellow_Slow_02.webm`,
                                },
                            },
                            purpleblack: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_PurpleBlack_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_PurpleBlack_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_PurpleBlack_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_PurpleBlack_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_PurpleBlack_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_PurpleBlack_Slow_02.webm`,
                                },
                            },
                            redblack: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_RedBlack_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_RedBlack_Fast_02.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_RedBlack_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_RedBlack_Normal_02.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_RedBlack_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Piercing/Medium/Attack_Melee_Generic_01_Piercing_Medium_RedBlack_Slow_02.webm`,
                                },
                            },
                        },
                    },
                    slashing: {
                        heavy: {
                            blue: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Blue_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Blue_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Blue_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Blue_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Blue_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Blue_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Blue_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Blue_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Blue_Slow_03.webm`,
                                },
                            },
                            green: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Green_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Green_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Green_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Green_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Green_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Green_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Green_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Green_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Green_Slow_03.webm`,
                                },
                            },
                            orange: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Orange_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Orange_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Orange_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Orange_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Orange_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Orange_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Orange_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Orange_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Orange_Slow_03.webm`,
                                },
                            },
                            purple: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Purple_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Purple_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Purple_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Purple_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Purple_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Purple_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Purple_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Purple_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Purple_Slow_03.webm`,
                                },
                            },
                            red: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Red_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Red_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Red_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Red_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Red_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Red_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Red_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Red_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Red_Slow_03.webm`,
                                },
                            },
                            yellow: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Yellow_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Yellow_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Yellow_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Yellow_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Yellow_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Yellow_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Yellow_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Yellow_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_Yellow_Slow_03.webm`,
                                },
                            },
                            purpleblack: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_PurpleBlack_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_PurpleBlack_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_PurpleBlack_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_PurpleBlack_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_PurpleBlack_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_PurpleBlack_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_PurpleBlack_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_PurpleBlack_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_PurpleBlack_Slow_03.webm`,
                                },
                            },
                            redblack: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_RedBlack_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_RedBlack_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_RedBlack_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_RedBlack_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_RedBlack_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_RedBlack_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_RedBlack_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_RedBlack_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Heavy/Attack_Melee_Generic_01_Slashing_Heavy_RedBlack_Slow_03.webm`,
                                },
                            },
                        },
                        light: {
                            blue: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Blue_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Blue_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Blue_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Blue_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Blue_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Blue_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Blue_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Blue_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Blue_Slow_03.webm`,
                                },
                            },
                            green: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Green_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Green_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Green_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Green_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Green_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Green_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Green_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Green_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Green_Slow_03.webm`,
                                },
                            },
                            orange: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Orange_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Orange_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Orange_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Orange_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Orange_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Orange_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Orange_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Orange_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Orange_Slow_03.webm`,
                                },
                            },
                            purple: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Purple_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Purple_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Purple_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Purple_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Purple_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Purple_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Purple_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Purple_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Purple_Slow_03.webm`,
                                },
                            },
                            red: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Red_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Red_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Red_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Red_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Red_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Red_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Red_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Red_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Red_Slow_03.webm`,
                                },
                            },
                            yellow: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Yellow_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Yellow_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Yellow_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Yellow_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Yellow_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Yellow_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Yellow_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Yellow_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_Yellow_Slow_03.webm`,
                                },
                            },
                            purpleblack: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_PurpleBlack_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_PurpleBlack_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_PurpleBlack_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_PurpleBlack_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_PurpleBlack_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_PurpleBlack_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_PurpleBlack_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_PurpleBlack_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_PurpleBlack_Slow_03.webm`,
                                },
                            },
                            redblack: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_RedBlack_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_RedBlack_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_RedBlack_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_RedBlack_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_RedBlack_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_RedBlack_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_RedBlack_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_RedBlack_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Light/Attack_Melee_Generic_01_Slashing_Light_RedBlack_Slow_03.webm`,
                                },
                            },
                        },
                        medium: {
                            blue: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Blue_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Blue_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Blue_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Blue_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Blue_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Blue_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Blue_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Blue_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Blue_Slow_03.webm`,
                                },
                            },
                            green: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Green_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Green_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Green_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Green_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Green_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Green_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Green_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Green_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Green_Slow_03.webm`,
                                },
                            },
                            orange: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Orange_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Orange_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Orange_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Orange_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Orange_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Orange_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Orange_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Orange_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Orange_Slow_03.webm`,
                                },
                            },
                            purple: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Purple_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Purple_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Purple_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Purple_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Purple_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Purple_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Purple_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Purple_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Purple_Slow_03.webm`,
                                },
                            },
                            red: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Red_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Red_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Red_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Red_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Red_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Red_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Red_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Red_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Red_Slow_03.webm`,
                                },
                            },
                            yellow: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Yellow_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Yellow_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Yellow_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Yellow_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Yellow_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Yellow_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Yellow_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Yellow_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_Yellow_Slow_03.webm`,
                                },
                            },
                            purpleblack: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_PurpleBlack_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_PurpleBlack_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_PurpleBlack_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_PurpleBlack_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_PurpleBlack_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_PurpleBlack_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_PurpleBlack_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_PurpleBlack_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_PurpleBlack_Slow_03.webm`,
                                },
                            },
                            redblack: {
                                fast:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_RedBlack_Fast_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_RedBlack_Fast_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_RedBlack_Fast_03.webm`,
                                },
                                normal:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_RedBlack_Normal_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_RedBlack_Normal_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_RedBlack_Normal_03.webm`,
                                },
                                slow:{
                                    '01': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_RedBlack_Slow_01.webm`,
                                    '02': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_RedBlack_Slow_02.webm`,
                                    '03': `${path}/Attack/Melee/Generic/Slashing/Medium/Attack_Melee_Generic_01_Slashing_Medium_RedBlack_Slow_03.webm`,
                                },
                            },
                        },
                    },
                },
            },
        },
        touch: {
            generic: {
                '01': {
                    blue: `${path}/Attack/Touch/Generic/Attack_Touch_Generic_01_Blue.webm`,
                    green: `${path}/Attack/Touch/Generic/Attack_Touch_Generic_01_Green.webm`,
                    orange: `${path}/Attack/Touch/Generic/Attack_Touch_Generic_01_Orange.webm`,
                    purple: `${path}/Attack/Touch/Generic/Attack_Touch_Generic_01_Purple.webm`,
                    red: `${path}/Attack/Touch/Generic/Attack_Touch_Generic_01_Red.webm`,
                    yellow: `${path}/Attack/Touch/Generic/Attack_Touch_Generic_01_Yellow.webm`,
                    black: `${path}/Attack/Touch/Generic/Attack_Touch_Generic_01_Black.webm`,
                    white: `${path}/Attack/Touch/Generic/Attack_Touch_Generic_01_White.webm`,   
                },
            },
        },
    };
    //--------------------
    //AURA
    //--------------------
    database.aura = {
        fire: {
            '01': {
                orange: `${path}/Aura/Fire/Aura_Fire_01_Orange.webm`,
            },
        },
        water: {
            '01': {
                blue: `${path}/Aura/Water/Aura_Water_01_Blue.webm`,
            },
        },
        token: {
            generic: {
                '01': {
                    _markers: {
                        loop: { start: 500, end: 2500 }
                    },
                    blue: `${path}/Aura/Token/Generic/Aura_Token_Generic_01_Blue.webm`,
                    green: `${path}/Aura/Token/Generic/Aura_Token_Generic_01_Green.webm`,
                    orange: `${path}/Aura/Token/Generic/Aura_Token_Generic_01_Orange.webm`,
                    purple: `${path}/Aura/Token/Generic/Aura_Token_Generic_01_Purple.webm`,
                    red: `${path}/Aura/Token/Generic/Aura_Token_Generic_01_Red.webm`,
                    yellow: `${path}/Aura/Token/Generic/Aura_Token_Generic_01_Yellow.webm`,
                    black: `${path}/Aura/Token/Generic/Aura_Token_Generic_01_Black.webm`,
                    white: `${path}/Aura/Token/Generic/Aura_Token_Generic_01_White.webm`,
                    rainbow: `${path}/Aura/Token/Generic/Aura_Token_Generic_01_Rainbow.webm`,
                    bluewhite: `${path}/Aura/Token/Generic/Aura_Token_Generic_01_BlueWhite.webm`,
                    purpleblack: `${path}/Aura/Token/Generic/Aura_Token_Generic_01_PurpleBlack.webm`,
                    redblack: `${path}/Aura/Token/Generic/Aura_Token_Generic_01_RedBlack.webm`,
                    redorange: `${path}/Aura/Token/Generic/Aura_Token_Generic_01_RedOrange.webm`,
                },
                '02': {
                    _markers: {
                        loop: { start: 500, end: 2500 }
                    },
                    blue: `${path}/Aura/Token/Generic/Aura_Token_Generic_02_Blue.webm`,
                    green: `${path}/Aura/Token/Generic/Aura_Token_Generic_02_Green.webm`,
                    orange: `${path}/Aura/Token/Generic/Aura_Token_Generic_02_Orange.webm`,
                    purple: `${path}/Aura/Token/Generic/Aura_Token_Generic_02_Purple.webm`,
                    red: `${path}/Aura/Token/Generic/Aura_Token_Generic_02_Red.webm`,
                    yellow: `${path}/Aura/Token/Generic/Aura_Token_Generic_02_Yellow.webm`,
                    black: `${path}/Aura/Token/Generic/Aura_Token_Generic_02_Black.webm`,
                    white: `${path}/Aura/Token/Generic/Aura_Token_Generic_02_White.webm`,
                    rainbow: `${path}/Aura/Token/Generic/Aura_Token_Generic_02_Rainbow.webm`,
                    bluewhite: `${path}/Aura/Token/Generic/Aura_Token_Generic_02_BlueWhite.webm`,
                    purpleblack: `${path}/Aura/Token/Generic/Aura_Token_Generic_02_PurpleBlack.webm`,
                    redblack: `${path}/Aura/Token/Generic/Aura_Token_Generic_02_RedBlack.webm`,
                    redorange: `${path}/Aura/Token/Generic/Aura_Token_Generic_02_RedOrange.webm`,
                },
                cursed_energy: {
                    '01': {
                        _markers: {
                            loop: { start: 500, end: 2500 }
                        },
                        blue: `${path}/Aura/Token/Generic/Cursed_Energy/Aura_Token_Generic_Cursed_Energy_01_Blue.webm`,
                        pink: `${path}/Aura/Token/Generic/Cursed_Energy/Aura_Token_Generic_Cursed_Energy_01_Pink.webm`,
                        purple: `${path}/Aura/Token/Generic/Cursed_Energy/Aura_Token_Generic_Cursed_Energy_01_Purple.webm`,
                        red: `${path}/Aura/Token/Generic/Cursed_Energy/Aura_Token_Generic_Cursed_Energy_01_Red.webm`,
                        teal: `${path}/Aura/Token/Generic/Cursed_Energy/Aura_Token_Generic_Cursed_Energy_01_Teal.webm`,
                    },  
                    '02': {
                        _markers: {
                            loop: { start: 500, end: 2500 }
                        },
                        blue: `${path}/Aura/Token/Generic/Cursed_Energy/Aura_Token_Generic_Cursed_Energy_02_Blue.webm`,
                        pink: `${path}/Aura/Token/Generic/Cursed_Energy/Aura_Token_Generic_Cursed_Energy_02_Pink.webm`,
                        purple: `${path}/Aura/Token/Generic/Cursed_Energy/Aura_Token_Generic_Cursed_Energy_02_Purple.webm`,
                        red: `${path}/Aura/Token/Generic/Cursed_Energy/Aura_Token_Generic_Cursed_Energy_02_Red.webm`,
                        teal: `${path}/Aura/Token/Generic/Cursed_Energy/Aura_Token_Generic_Cursed_Energy_02_Teal.webm`,
                    },
                },
            },
            ribbon: {
                '01': {
                    blue: `${path}/Aura/Token/Ribbon/Aura_Token_Ribbon_01_Blue.webm`,
                    green: `${path}/Aura/Token/Ribbon/Aura_Token_Ribbon_01_Green.webm`,
                    purple: `${path}/Aura/Token/Ribbon/Aura_Token_Ribbon_01_Purple.webm`,
                    red: `${path}/Aura/Token/Ribbon/Aura_Token_Ribbon_01_Red.webm`,
                    teal: `${path}/Aura/Token/Ribbon/Aura_Token_Ribbon_01_Teal.webm`,
                    darkpurple: `${path}/Aura/Token/Ribbon/Aura_Token_Ribbon_01_Darkpurple.webm`,
                },
                '02': {
                    blue: `${path}/Aura/Token/Ribbon/Aura_Token_Ribbon_02_Blue.webm`,
                    green: `${path}/Aura/Token/Ribbon/Aura_Token_Ribbon_02_Green.webm`,
                    purple: `${path}/Aura/Token/Ribbon/Aura_Token_Ribbon_02_Purple.webm`,
                    red: `${path}/Aura/Token/Ribbon/Aura_Token_Ribbon_02_Red.webm`,
                    teal: `${path}/Aura/Token/Ribbon/Aura_Token_Ribbon_02_Teal.webm`,
                    darkpurple: `${path}/Aura/Token/Ribbon/Aura_Token_Ribbon_02_Darkpurple.webm`,
                },
            },
        },
    };    
    //--------------------
    //BUFF
    //--------------------
    database.buff = {
        one_shot: {
            attack: {
                blue: `${path}/Buff/OneShot/Buff_Attack_Blue.webm`,
                green: `${path}/Buff/OneShot/Buff_Attack_Green.webm`,
                orange: `${path}/Buff/OneShot/Buff_Attack_Orange.webm`,
                red: `${path}/Buff/OneShot/Buff_Attack_Red.webm`,
            },
            defense: {
                blue: `${path}/Buff/OneShot/Buff_Defense_Blue.webm`,
                green: `${path}/Buff/OneShot/Buff_Defense_Green.webm`,
                orange: `${path}/Buff/OneShot/Buff_Defense_Orange.webm`,
                red: `${path}/Buff/OneShot/Buff_Defense_Red.webm`,
            },
            health: {
                blue: `${path}/Buff/OneShot/Buff_Health_Blue.webm`,
                green: `${path}/Buff/OneShot/Buff_Health_Green.webm`,
                orange: `${path}/Buff/OneShot/Buff_Health_Orange.webm`,
                red: `${path}/Buff/OneShot/Buff_Health_Red.webm`,
            },
            simple: {
                blue: `${path}/Buff/OneShot/Buff_Simple_Blue.webm`,
                green: `${path}/Buff/OneShot/Buff_Simple_Green.webm`,
                orange: `${path}/Buff/OneShot/Buff_Simple_Orange.webm`,
                red: `${path}/Buff/OneShot/Buff_Simple_Red.webm`,
            },
            sphere: {
                blue: `${path}/Buff/OneShot/Buff_Sphere_Blue.webm`,
                green: `${path}/Buff/OneShot/Buff_Sphere_Green.webm`,
                orange: `${path}/Buff/OneShot/Buff_Sphere_Orange.webm`,
                red: `${path}/Buff/OneShot/Buff_Sphere_Red.webm`,
            },
        },
        loop:{
           attack: {
                blue: `${path}/Buff/Loop/Buff_Loop_Attack_Blue.webm`,
                green: `${path}/Buff/Loop/Buff_Loop_Attack_Green.webm`,
                orange: `${path}/Buff/Loop/Buff_Loop_Attack_Orange.webm`,
                red: `${path}/Buff/Loop/Buff_Loop_Attack_Red.webm`,
            },
            defense: {
                blue: `${path}/Buff/Loop/Buff_Loop_Defense_Blue.webm`,
                green: `${path}/Buff/Loop/Buff_Loop_Defense_Green.webm`,
                orange: `${path}/Buff/Loop/Buff_Loop_Defense_Orange.webm`,
                red: `${path}/Buff/Loop/Buff_Loop_Defense_Red.webm`,
            },
            health: {
                blue: `${path}/Buff/Loop/Buff_Loop_Health_Blue.webm`,
                green: `${path}/Buff/Loop/Buff_Loop_Health_Green.webm`,
                orange: `${path}/Buff/Loop/Buff_Loop_Health_Orange.webm`,
                red: `${path}/Buff/Loop/Buff_Loop_Health_Red.webm`,
            },
            simple: {
                blue: `${path}/Buff/Loop/Buff_Loop_Simple_Blue.webm`,
                green: `${path}/Buff/Loop/Buff_Loop_Simple_Green.webm`,
                orange: `${path}/Buff/Loop/Buff_Loop_Simple_Orange.webm`,
                red: `${path}/Buff/Loop/Buff_Loop_Simple_Red.webm`,
            },
            sphere: {
                blue: `${path}/Buff/Loop/Buff_Loop_Sphere_Blue.webm`,
                green: `${path}/Buff/Loop/Buff_Loop_Sphere_Green.webm`,
                orange: `${path}/Buff/Loop/Buff_Loop_Sphere_Orange.webm`,
                red: `${path}/Buff/Loop/Buff_Loop_Sphere_Red.webm`,
            }, 
        },
    };
    //--------------------
    //BURN
    //--------------------
    database.burn = {
        embers: {
            blue: `${path}/Burn/Embers/Burn_Embers_Blue.webm`,
            green: `${path}/Burn/Embers/Burn_Embers_Green.webm`,
            orange: `${path}/Burn/Embers/Burn_Embers_Orange.webm`,
            purple: `${path}/Burn/Embers/Burn_Embers_Purple.webm`,
            red: `${path}/Burn/Embers/Burn_Embers_Red.webm`,
            yellow: `${path}/Burn/Embers/Burn_Embers_Yellow.webm`,
        },
        token_mask: {
            blue: {
                fast: {
                    '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Blue_Fast.webm`,
                    '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Blue_Fast.webm`,
                    '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Blue_Fast.webm`,
                },
                normal: {
                    '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Blue_Normal.webm`,
                    '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Blue_Normal.webm`,
                    '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Blue_Normal.webm`,
                },
                slow: {
                    '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Blue_Slow.webm`,
                    '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Blue_Slow.webm`,
                    '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Blue_Slow.webm`,
                },
                no_base:{
                    fast: {
                        '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Blue_Fast_NoBase.webm`,
                        '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Blue_Fast_NoBase.webm`,
                        '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Blue_Fast_NoBase.webm`,
                    },
                    normal: {
                        '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Blue_Normal_NoBase.webm`,
                        '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Blue_Normal_NoBase.webm`,
                        '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Blue_Normal_NoBase.webm`,
                    },
                    slow: {
                        '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Blue_Slow_NoBase.webm`,
                        '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Blue_Slow_NoBase.webm`,
                        '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Blue_Slow_NoBase.webm`,
                    },
                },                
            },
            green: {
                fast: {
                    '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Green_Fast.webm`,
                    '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Green_Fast.webm`,
                    '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Green_Fast.webm`,
                },
                normal: {
                    '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Green_Normal.webm`,
                    '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Green_Normal.webm`,
                    '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Green_Normal.webm`,
                },
                slow: {
                    '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Green_Slow.webm`,
                    '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Green_Slow.webm`,
                    '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Green_Slow.webm`,
                },
                no_base:{
                    fast: {
                        '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Green_Fast_NoBase.webm`,
                        '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Green_Fast_NoBase.webm`,
                        '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Green_Fast_NoBase.webm`,
                    },
                    normal: {
                        '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Green_Normal_NoBase.webm`,
                        '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Green_Normal_NoBase.webm`,
                        '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Green_Normal_NoBase.webm`,
                    },
                    slow: {
                        '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Green_Slow_NoBase.webm`,
                        '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Green_Slow_NoBase.webm`,
                        '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Green_Slow_NoBase.webm`,
                    },
                },                                  
            },
            orange: {
                fast: {
                    '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Orange_Fast.webm`,
                    '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Orange_Fast.webm`,
                    '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Orange_Fast.webm`,
                },
                normal: {
                    '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Orange_Normal.webm`,
                    '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Orange_Normal.webm`,
                    '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Orange_Normal.webm`,
                },
                slow: {
                    '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Orange_Slow.webm`,
                    '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Orange_Slow.webm`,
                    '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Orange_Slow.webm`,
                },
                no_base:{
                    fast: {
                        '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Orange_Fast_NoBase.webm`,
                        '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Orange_Fast_NoBase.webm`,
                        '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Orange_Fast_NoBase.webm`,
                    },
                    normal: {
                        '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Orange_Normal_NoBase.webm`,
                        '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Orange_Normal_NoBase.webm`,
                        '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Orange_Normal_NoBase.webm`,
                    },
                    slow: {
                        '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Orange_Slow_NoBase.webm`,
                        '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Orange_Slow_NoBase.webm`,
                        '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Orange_Slow_NoBase.webm`,
                    },
                },                                  
            },
            purple: {
                fast: {
                    '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Purple_Fast.webm`,
                    '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Purple_Fast.webm`,
                    '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Purple_Fast.webm`,
                },
                normal: {
                    '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Purple_Normal.webm`,
                    '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Purple_Normal.webm`,
                    '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Purple_Normal.webm`,
                },
                slow: {
                    '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Purple_Slow.webm`,
                    '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Purple_Slow.webm`,
                    '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Purple_Slow.webm`,
                },
                no_base:{
                    fast: {
                        '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Purple_Fast_NoBase.webm`,
                        '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Purple_Fast_NoBase.webm`,
                        '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Purple_Fast_NoBase.webm`,
                    },
                    normal: {
                        '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Purple_Normal_NoBase.webm`,
                        '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Purple_Normal_NoBase.webm`,
                        '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Purple_Normal_NoBase.webm`,
                    },
                    slow: {
                        '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Purple_Slow_NoBase.webm`,
                        '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Purple_Slow_NoBase.webm`,
                        '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Purple_Slow_NoBase.webm`,
                    },
                },                  
            },
            red: {
                fast: {
                    '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Red_Fast.webm`,
                    '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Red_Fast.webm`,
                    '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Red_Fast.webm`,
                },
                normal: {
                    '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Red_Normal.webm`,
                    '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Red_Normal.webm`,
                    '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Red_Normal.webm`,
                },
                slow: {
                    '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Red_Slow.webm`,
                    '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Red_Slow.webm`,
                    '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Red_Slow.webm`,
                },
                no_base:{
                    fast: {
                        '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Red_Fast_NoBase.webm`,
                        '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Red_Fast_NoBase.webm`,
                        '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Red_Fast_NoBase.webm`,
                    },
                    normal: {
                        '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Red_Normal_NoBase.webm`,
                        '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Red_Normal_NoBase.webm`,
                        '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Red_Normal_NoBase.webm`,
                    },
                    slow: {
                        '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Red_Slow_NoBase.webm`,
                        '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Red_Slow_NoBase.webm`,
                        '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Red_Slow_NoBase.webm`,
                    },
                },                  
            },
            yellow: {
                fast: {    
                    '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Yellow_Fast.webm`,
                    '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Yellow_Fast.webm`,
                    '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Yellow_Fast.webm`,
                },
                normal: {
                    '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Yellow_Normal.webm`,
                    '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Yellow_Normal.webm`,
                    '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Yellow_Normal.webm`,
                },
                slow: {
                    '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Yellow_Slow.webm`,
                    '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Yellow_Slow.webm`,
                    '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Yellow_Slow.webm`,
                },
                no_base:{
                    fast: {
                        '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Yellow_Fast_NoBase.webm`,
                        '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Yellow_Fast_NoBase.webm`,
                        '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Yellow_Fast_NoBase.webm`,
                    },
                    normal: {
                        '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Yellow_Normal_NoBase.webm`,
                        '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Yellow_Normal_NoBase.webm`,
                        '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Yellow_Normal_NoBase.webm`,
                    },
                    slow: {
                        '01': `${path}/Burn/Token_Mask/Burn_TokenMask_01_Yellow_Slow_NoBase.webm`,
                        '02': `${path}/Burn/Token_Mask/Burn_TokenMask_02_Yellow_Slow_NoBase.webm`,
                        '03': `${path}/Burn/Token_Mask/Burn_TokenMask_03_Yellow_Slow_NoBase.webm`,
                    },
                },                  
            },
        },
    };
    //--------------------
    //CROSSHAIR
    //--------------------
    database.crosshair = {
        circle: {
            fantasy_01:{
                red: {
                    full:{
                        'radius_10ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Red_10ft.webm`,
                        'radius_20ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Red_20ft.webm`,
                        'radius_30ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Red_30ft.webm`,
                        'radius_60ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Red_60ft.webm`,
                    },
                    no_base:{
                        'radius_10ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Red_NoBase_10ft.webm`,
                        'radius_20ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Red_NoBase_20ft.webm`,
                        'radius_30ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Red_NoBase_30ft.webm`,
                        'radius_60ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Red_NoBase_60ft.webm`,
                    },
                },
                teal: {
                    full:{
                        'radius_10ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Teal_10ft.webm`,
                        'radius_20ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Teal_20ft.webm`,
                        'radius_30ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Teal_30ft.webm`,
                        'radius_60ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Teal_60ft.webm`,
                    },
                    no_base:{
                        'radius_10ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Teal_NoBase_10ft.webm`,
                        'radius_20ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Teal_NoBase_20ft.webm`,
                        'radius_30ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Teal_NoBase_30ft.webm`,
                        'radius_60ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Teal_NoBase_60ft.webm`,
                    },
                },
                white:{
                    full:{
                        'radius_10ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_White_10ft.webm`,
                        'radius_20ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_White_20ft.webm`,
                        'radius_30ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_White_30ft.webm`,
                        'radius_60ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_White_60ft.webm`,
                    },
                    no_base:{
                        'radius_10ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_White_NoBase_10ft.webm`,
                        'radius_20ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_White_NoBase_20ft.webm`,
                        'radius_30ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_White_NoBase_30ft.webm`,
                        'radius_60ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_White_NoBase_60ft.webm`,
                    },
                },
                yellow:{
                    full:{
                        'radius_10ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Yellow_10ft.webm`,
                        'radius_20ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Yellow_20ft.webm`,
                        'radius_30ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Yellow_30ft.webm`,
                        'radius_60ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Yellow_60ft.webm`,
                    },
                    no_base:{
                        'radius_10ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Yellow_NoBase_10ft.webm`,
                        'radius_20ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Yellow_NoBase_20ft.webm`,
                        'radius_30ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Yellow_NoBase_30ft.webm`,
                        'radius_60ft': `${path}/Crosshair/Circle/Fantasy_01/Crosshair_Circle_Fantasy_01_Yellow_NoBase_60ft.webm`,
                    },
                },
            },
        },
        cone:{
            thin:{
                fantasy_01:{
                    red:{
                        full:{
                            '15ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Red_15ft.webm`,
                            '30ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Red_30ft.webm`,
                            '60ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Red_60ft.webm`,
                            '90ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Red_90ft.webm`,
                        },
                        no_base:{
                            '15ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Red_NoBase_15ft.webm`,
                            '30ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Red_NoBase_30ft.webm`,
                            '60ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Red_NoBase_60ft.webm`,
                            '90ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Red_NoBase_90ft.webm`,
                        },
                    },
                    teal:{
                        full:{
                            '15ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Teal_15ft.webm`,
                            '30ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Teal_30ft.webm`,
                            '60ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Teal_60ft.webm`,
                            '90ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Teal_90ft.webm`,
                        },
                        no_base:{
                            '15ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Teal_NoBase_15ft.webm`,
                            '30ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Teal_NoBase_30ft.webm`,
                            '60ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Teal_NoBase_60ft.webm`,
                            '90ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Teal_NoBase_90ft.webm`,
                        },
                    },
                    white:{
                        full:{
                            '15ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_White_15ft.webm`,
                            '30ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_White_30ft.webm`,
                            '60ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_White_60ft.webm`,
                            '90ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_White_90ft.webm`,
                        },
                        no_base:{
                            '15ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_White_NoBase_15ft.webm`,
                            '30ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_White_NoBase_30ft.webm`,
                            '60ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_White_NoBase_60ft.webm`,
                            '90ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_White_NoBase_90ft.webm`,
                        },
                    },
                    yellow:{
                        full:{
                            '15ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Yellow_15ft.webm`,
                            '30ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Yellow_30ft.webm`,
                            '60ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Yellow_60ft.webm`,
                            '90ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Yellow_90ft.webm`,
                        },
                        no_base:{
                            '15ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Yellow_NoBase_15ft.webm`,
                            '30ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Yellow_NoBase_30ft.webm`,
                            '60ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Yellow_NoBase_60ft.webm`,
                            '90ft': `${path}/Crosshair/Cone/Thin/Fantasy_01/Crosshair_Cone_Thin_Fantasy_01_Yellow_NoBase_90ft.webm`,
                        },
                    },
                },
            },
            wide:{
                fantasy_01:{
                    red:{
                        full:{
                            '15ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Red_15ft.webm`,
                            '30ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Red_30ft.webm`,
                            '60ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Red_60ft.webm`,
                            '90ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Red_90ft.webm`,
                        },
                        no_base:{
                            '15ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Red_NoBase_15ft.webm`,
                            '30ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Red_NoBase_30ft.webm`,
                            '60ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Red_NoBase_60ft.webm`,
                            '90ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Red_NoBase_90ft.webm`,
                        },
                    },
                    teal:{
                        full:{
                            '15ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Teal_15ft.webm`,
                            '30ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Teal_30ft.webm`,
                            '60ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Teal_60ft.webm`,
                            '90ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Teal_90ft.webm`,
                        },
                        no_base:{
                            '15ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Teal_NoBase_15ft.webm`,
                            '30ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Teal_NoBase_30ft.webm`,
                            '60ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Teal_NoBase_60ft.webm`,
                            '90ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Teal_NoBase_90ft.webm`,
                        },
                    },
                    white:{
                        full:{
                            '15ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_White_15ft.webm`,
                            '30ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_White_30ft.webm`,
                            '60ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_White_60ft.webm`,
                            '90ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_White_90ft.webm`,
                        },
                        no_base:{
                            '15ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_White_NoBase_15ft.webm`,
                            '30ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_White_NoBase_30ft.webm`,
                            '60ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_White_NoBase_60ft.webm`,
                            '90ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_White_NoBase_90ft.webm`,
                        },
                    },
                    yellow:{
                        full:{
                            '15ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Yellow_15ft.webm`,
                            '30ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Yellow_30ft.webm`,
                            '60ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Yellow_60ft.webm`,
                            '90ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Yellow_90ft.webm`,
                        },
                        no_base:{
                            '15ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Yellow_NoBase_15ft.webm`,
                            '30ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Yellow_NoBase_30ft.webm`,
                            '60ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Yellow_NoBase_60ft.webm`,
                            '90ft': `${path}/Crosshair/Cone/Wide/Fantasy_01/Crosshair_Cone_Wide_Fantasy_01_Yellow_NoBase_90ft.webm`,
                        },
                    },
                },
            },
        },
        line:{
            generic_01:{
                red:{
                    '05ft': `${path}/Crosshair/Line/Generic_01/Crosshair_Line_Generic_01_Red_05ft.webm`,
                    '15ft': `${path}/Crosshair/Line/Generic_01/Crosshair_Line_Generic_01_Red_15ft.webm`,
                    '30ft': `${path}/Crosshair/Line/Generic_01/Crosshair_Line_Generic_01_Red_30ft.webm`,
                    '60ft': `${path}/Crosshair/Line/Generic_01/Crosshair_Line_Generic_01_Red_60ft.webm`,
                    '90ft': `${path}/Crosshair/Line/Generic_01/Crosshair_Line_Generic_01_Red_90ft.webm`,
                },
                teal:{
                    '05ft': `${path}/Crosshair/Line/Generic_01/Crosshair_Line_Generic_01_Teal_05ft.webm`,
                    '15ft': `${path}/Crosshair/Line/Generic_01/Crosshair_Line_Generic_01_Teal_15ft.webm`,
                    '30ft': `${path}/Crosshair/Line/Generic_01/Crosshair_Line_Generic_01_Teal_30ft.webm`,
                    '60ft': `${path}/Crosshair/Line/Generic_01/Crosshair_Line_Generic_01_Teal_60ft.webm`,
                    '90ft': `${path}/Crosshair/Line/Generic_01/Crosshair_Line_Generic_01_Teal_90ft.webm`,
                },
                white:{
                    '05ft': `${path}/Crosshair/Line/Generic_01/Crosshair_Line_Generic_01_White_05ft.webm`,
                    '15ft': `${path}/Crosshair/Line/Generic_01/Crosshair_Line_Generic_01_White_15ft.webm`,
                    '30ft': `${path}/Crosshair/Line/Generic_01/Crosshair_Line_Generic_01_White_30ft.webm`,
                    '60ft': `${path}/Crosshair/Line/Generic_01/Crosshair_Line_Generic_01_White_60ft.webm`,
                    '90ft': `${path}/Crosshair/Line/Generic_01/Crosshair_Line_Generic_01_White_90ft.webm`,
                },
                yellow:{
                    '05ft': `${path}/Crosshair/Line/Generic_01/Crosshair_Line_Generic_01_Yellow_05ft.webm`,
                    '15ft': `${path}/Crosshair/Line/Generic_01/Crosshair_Line_Generic_01_Yellow_15ft.webm`,
                    '30ft': `${path}/Crosshair/Line/Generic_01/Crosshair_Line_Generic_01_Yellow_30ft.webm`,
                    '60ft': `${path}/Crosshair/Line/Generic_01/Crosshair_Line_Generic_01_Yellow_60ft.webm`,
                    '90ft': `${path}/Crosshair/Line/Generic_01/Crosshair_Line_Generic_01_Yellow_90ft.webm`,
                },
            },
        },
        ray:{
            fantasy_01:{
                red:{
                    full:{
                        '05ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Red_05ft.webm`,
                        '15ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Red_15ft.webm`,
                        '30ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Red_30ft.webm`,
                        '60ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Red_60ft.webm`,
                        '90ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Red_90ft.webm`,
                    },
                    no_base:{
                        '05ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Red_NoBase_05ft.webm`,
                        '15ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Red_NoBase_15ft.webm`,
                        '30ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Red_NoBase_30ft.webm`,
                        '60ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Red_NoBase_60ft.webm`,
                        '90ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Red_NoBase_90ft.webm`,
                    },
                },
                teal:{
                    full:{
                        '05ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Teal_05ft.webm`,
                        '15ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Teal_15ft.webm`,
                        '30ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Teal_30ft.webm`,
                        '60ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Teal_60ft.webm`,
                        '90ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Teal_90ft.webm`,
                    },
                    no_base:{
                        '05ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Teal_NoBase_05ft.webm`,
                        '15ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Teal_NoBase_15ft.webm`,
                        '30ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Teal_NoBase_30ft.webm`,
                        '60ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Teal_NoBase_60ft.webm`,
                        '90ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Teal_NoBase_90ft.webm`,
                    },
                },
                white:{
                    full:{
                        '05ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_White_05ft.webm`,
                        '15ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_White_15ft.webm`,
                        '30ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_White_30ft.webm`,
                        '60ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_White_60ft.webm`,
                        '90ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_White_90ft.webm`,
                    },
                    no_base:{
                        '05ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_White_NoBase_05ft.webm`,
                        '15ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_White_NoBase_15ft.webm`,
                        '30ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_White_NoBase_30ft.webm`,
                        '60ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_White_NoBase_60ft.webm`,
                        '90ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_White_NoBase_90ft.webm`,
                    },
                },
                yellow:{
                    full:{
                        '05ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Yellow_05ft.webm`,
                        '15ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Yellow_15ft.webm`,
                        '30ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Yellow_30ft.webm`,
                        '60ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Yellow_60ft.webm`,
                        '90ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Yellow_90ft.webm`,
                    },
                    no_base:{
                        '05ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Yellow_NoBase_05ft.webm`,
                        '15ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Yellow_NoBase_15ft.webm`,
                        '30ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Yellow_NoBase_30ft.webm`,
                        '60ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Yellow_NoBase_60ft.webm`,
                        '90ft': `${path}/Crosshair/Ray/Fantasy_01/Crosshair_Ray_Fantasy_01_Yellow_NoBase_90ft.webm`,
                    },
                },
            },
        },
    };
    //--------------------
    //DAMAGE
    //--------------------
    database.damage = {
        bludgeoning: {
            '01': {
                red: `${path}/Damage/Bludgeoning/Damage_Bludgeoning_01_Red.webm`,
                yellow: `${path}/Damage/Bludgeoning/Damage_Bludgeoning_01_Yellow.webm`,
                white: `${path}/Damage/Bludgeoning/Damage_Bludgeoning_01_White.webm`,
            },
        },
        piercing: {
            '01': {
                red: `${path}/Damage/Piercing/Damage_Piercing_01_Red.webm`,
                yellow: `${path}/Damage/Piercing/Damage_Piercing_01_Yellow.webm`,
                white: `${path}/Damage/Piercing/Damage_Piercing_01_White.webm`,
            },
        },
        slashing: {
            '01': {
                red: `${path}/Damage/Slashing/Damage_Slashing_01_Red.webm`,
                yellow: `${path}/Damage/Slashing/Damage_Slashing_01_Yellow.webm`,
                white: `${path}/Damage/Slashing/Damage_Slashing_01_White.webm`,
            },
        },
        critical: {
            '01': {
                blue: `${path}/Damage/Critical/Damage_Critical_01_Blue.webm`,
                green: `${path}/Damage/Critical/Damage_Critical_01_Green.webm`,
                orange: `${path}/Damage/Critical/Damage_Critical_01_Orange.webm`,
                purple: `${path}/Damage/Critical/Damage_Critical_01_Purple.webm`,
                red: `${path}/Damage/Critical/Damage_Critical_01_Red.webm`,
                yellow: `${path}/Damage/Critical/Damage_Critical_01_Yellow.webm`,
                white: `${path}/Damage/Critical/Damage_Critical_01_White.webm`,
            },
            '02': {
                blue: `${path}/Damage/Critical/Damage_Critical_02_Blue.webm`,
                green: `${path}/Damage/Critical/Damage_Critical_02_Green.webm`,
                orange: `${path}/Damage/Critical/Damage_Critical_02_Orange.webm`,
                purple: `${path}/Damage/Critical/Damage_Critical_02_Purple.webm`,
                red: `${path}/Damage/Critical/Damage_Critical_02_Red.webm`,
                yellow: `${path}/Damage/Critical/Damage_Critical_02_Yellow.webm`,
                white: `${path}/Damage/Critical/Damage_Critical_02_White.webm`,
            },
            '03': {
                blue: `${path}/Damage/Critical/Damage_Critical_03_Blue.webm`,
                green: `${path}/Damage/Critical/Damage_Critical_03_Green.webm`,
                orange: `${path}/Damage/Critical/Damage_Critical_03_Orange.webm`,
                purple: `${path}/Damage/Critical/Damage_Critical_03_Purple.webm`,
                red: `${path}/Damage/Critical/Damage_Critical_03_Red.webm`,
                yellow: `${path}/Damage/Critical/Damage_Critical_03_Yellow.webm`,
                white: `${path}/Damage/Critical/Damage_Critical_03_White.webm`,
            },
        },
        acid: {
            '01': {
                green: `${path}/Damage/Acid/Damage_Acid_01_Green.webm`,
                teal: `${path}/Damage/Acid/Damage_Acid_01_Teal.webm`,
                red: `${path}/Damage/Acid/Damage_Acid_01_Red.webm`,
            },
        },
        cold: {
            '01': {
                blue: `${path}/Damage/Cold/Damage_Cold_01_Blue.webm`,
                white: `${path}/Damage/Cold/Damage_Cold_01_White.webm`,
                darkpurple: `${path}/Damage/Cold/Damage_Cold_01_Darkpurple.webm`,
            },
        },
        electricity: {
            '01': {
                blue: `${path}/Damage/Electricity/Damage_Electricity_01_Blue.webm`,
                purple: `${path}/Damage/Electricity/Damage_Electricity_01_Purple.webm`,
                yellow: `${path}/Damage/Electricity/Damage_Electricity_01_Yellow.webm`,
            },
        },
        fire: {
            '01': {
                blue: `${path}/Damage/Fire/Damage_Fire_01_Blue.webm`,
                green: `${path}/Damage/Fire/Damage_Fire_01_Green.webm`,
                orange: `${path}/Damage/Fire/Damage_Fire_01_Orange.webm`,
            },
        },
        force: {
            '01': {
                white: `${path}/Damage/Force/Damage_Force_01_White.webm`,
                lightpurple: `${path}/Damage/Force/Damage_Force_01_Lightpurple.webm`,
            },
        },
        necrotic: {
            '01': {
                black: `${path}/Damage/Necrotic/Damage_Necrotic_01_Black.webm`,
                teal: `${path}/Damage/Necrotic/Damage_Necrotic_01_Teal.webm`,
            },
        },
        poison: {
            '01': {
                green: `${path}/Damage/Poison/Damage_Poison_01_Green.webm`,
                purple: `${path}/Damage/Poison/Damage_Poison_01_Purple.webm`,
                yellow: `${path}/Damage/Poison/Damage_Poison_01_Yellow.webm`,
            },
        },
        psychic: {
            '01': {
                pink: `${path}/Damage/Psychic/Damage_Psychic_01_Pink.webm`,
                red: `${path}/Damage/Psychic/Damage_Psychic_01_Red.webm`,
                darkpurple: `${path}/Damage/Psychic/Damage_Psychic_01_Darkpurple.webm`,
            },
        },
        radiant: {
            '01': {
                yellow: `${path}/Damage/Radiant/Damage_Radiant_01_Yellow.webm`,
                rainbow: `${path}/Damage/Radiant/Damage_Radiant_01_Rainbow.webm`,
            },
        },
        thunder: {
            '01': {
                white: `${path}/Damage/Thunder/Damage_Thunder_01_White.webm`,
                lightpurple: `${path}/Damage/Thunder/Damage_Thunder_01_Lightpurple.webm`,
            },
        },
    };
    //--------------------
    //EMOTE
    //--------------------
    database.emote = {
        angry: { 
            '01': `${path}/Emote/Emote_Angry.webm`,
            '02': `${path}/Emote/Emote_Angry_02.webm`,
        },
        blush: { 
            '01': {
                 _markers: {
                    loop: { start: 500, end: 1000 }
                },
                pink: `${path}/Emote/Emote_Blush_Pink.webm`,
                red: `${path}/Emote/Emote_Blush_Red.webm`,
            },
        },
        cigarette: { 
            '01': `${path}/Emote/Emote_Cigarette.webm` 
        },
        confused: { 
            _markers: {
                loop: { start: 500, end: 1500 }
            },
            '01': `${path}/Emote/Emote_Confused.webm`,
        },
        cry: { 
            '01': `${path}/Emote/Emote_Cry.webm` 
        },
        disgusted: { 
            _markers: {
                loop: { start: 500, end: 1500 }
            },
            '01': `${path}/Emote/Emote_Disgusted.webm`,
            '02': `${path}/Emote/Emote_Disgusted_02.webm`, 
        },
        drunk_bubbles: { 
            '01': `${path}/Emote/Emote_DrunkBubbles.webm` 
        },
        laugh: {
            '01': {
                blue: `${path}/Emote/Emote_Laugh_Blue.webm`,
                pink: `${path}/Emote/Emote_Laugh_Pink.webm`,
                yellow: `${path}/Emote/Emote_Laugh_Yellow.webm`,
            },
            '02': {
                blue: `${path}/Emote/Emote_Laugh_02_Blue.webm`,
                pink: `${path}/Emote/Emote_Laugh_02_Pink.webm`,
                yellow: `${path}/Emote/Emote_Laugh_02_Yellow.webm`,
            },
        },
        love: { 
            '01': `${path}/Emote/Emote_Love.webm` 
        },
        nervous: { 
            '01': `${path}/Emote/Emote_Nervous.webm` ,
            '02': `${path}/Emote/Emote_Nervous_02.webm`,
        },
        shout: { 
            '01': `${path}/Emote/Emote_Shout.webm` 
        },
        soul_sucked: { 
            '01': `${path}/Emote/Emote_SoulSucked.webm` 
        },
        surprised: {
            _markers: {
                loop: { start: 200, end: 400 }
            },
            '01': `${path}/Emote/Emote_Surprised.webm`,
            '02': `${path}/Emote/Emote_Surprised_02.webm`,
        },
        whistle: {
            '01': `${path}/Emote/Emote_Whistle.webm`
        },
        emote_bubble: {
            _markers: {
                loop: { start: 1000, end: 2500 }
            },
            confused: `${path}/Emote/Emote_Bubble/Emote_Bubble_Confused.webm`,
            smug: `${path}/Emote/Emote_Bubble/Emote_Bubble_Smug.webm`,
            thank_you: `${path}/Emote/Emote_Bubble/Emote_Bubble_ThankYou.webm`,
            wink: `${path}/Emote/Emote_Bubble/Emote_Bubble_Wink.webm`,
        },
    };
    //--------------------
    //ENVIRONMENT
    //--------------------
    database.environment = {
        beacon: {
            generic: {
                '01': {
                    _markers: {
                    loop: { start: 1500, end: 3000 }
                    },
                    blue: `${path}/Environment/Beacon/Generic/Environment_Beacon_Generic_01_Blue.webm`,
                    green: `${path}/Environment/Beacon/Generic/Environment_Beacon_Generic_01_Green.webm`,
                    purple: `${path}/Environment/Beacon/Generic/Environment_Beacon_Generic_01_Purple.webm`,
                    red: `${path}/Environment/Beacon/Generic/Environment_Beacon_Generic_01_Red.webm`,
                    teal: `${path}/Environment/Beacon/Generic/Environment_Beacon_Generic_01_Teal.webm`,
                    white: `${path}/Environment/Beacon/Generic/Environment_Beacon_Generic_01_White.webm`,
                    purpleblack: `${path}/Environment/Beacon/Generic/Environment_Beacon_Generic_01_PurpleBlack.webm`,
                    redblack: `${path}/Environment/Beacon/Generic/Environment_Beacon_Generic_01_RedBlack.webm`,
                },
            },
        },
        fog: {
            rolling: {
                '01': {
                    blue: {
                        single: `${path}/Environment/Fog/Rolling/01/Environment_Fog_Rolling_01_Blue_Single.webm`,
                        few: `${path}/Environment/Fog/Rolling/01/Environment_Fog_Rolling_01_Blue_Few.webm`,
                    },
                    green: {
                        single: `${path}/Environment/Fog/Rolling/01/Environment_Fog_Rolling_01_Green_Single.webm`,
                        few: `${path}/Environment/Fog/Rolling/01/Environment_Fog_Rolling_01_Green_Few.webm`,
                    },
                    purple: {
                        single: `${path}/Environment/Fog/Rolling/01/Environment_Fog_Rolling_01_Purple_Single.webm`,
                        few: `${path}/Environment/Fog/Rolling/01/Environment_Fog_Rolling_01_Purple_Few.webm`,
                    },
                    red: {
                        single: `${path}/Environment/Fog/Rolling/01/Environment_Fog_Rolling_01_Red_Single.webm`,
                        few: `${path}/Environment/Fog/Rolling/01/Environment_Fog_Rolling_01_Red_Few.webm`,
                    },
                    teal: {
                        single: `${path}/Environment/Fog/Rolling/01/Environment_Fog_Rolling_01_Teal_Single.webm`,
                        few: `${path}/Environment/Fog/Rolling/01/Environment_Fog_Rolling_01_Teal_Few.webm`,
                    },
                    black: {
                        single: `${path}/Environment/Fog/Rolling/01/Environment_Fog_Rolling_01_Black_Single.webm`,
                        few: `${path}/Environment/Fog/Rolling/01/Environment_Fog_Rolling_01_Black_Few.webm`,
                    },
                    white: {
                        single: `${path}/Environment/Fog/Rolling/01/Environment_Fog_Rolling_01_White_Single.webm`,
                        few: `${path}/Environment/Fog/Rolling/01/Environment_Fog_Rolling_01_White_Few.webm`,
                    },
                },
            },
        },
        lighting: {
            bokeh: {
                gold: {
                    few: `${path}/Environment/Lighting/Bokeh/Bokeh_Gold_Few.webm`,
                    many: `${path}/Environment/Lighting/Bokeh/Bokeh_Gold_Many.webm`,
                    large: `${path}/Environment/Lighting/Bokeh/Bokeh_Gold_Large.webm`,
                },
                orange: {
                    few: `${path}/Environment/Lighting/Bokeh/Bokeh_Orange_Few.webm`,
                    many: `${path}/Environment/Lighting/Bokeh/Bokeh_Orange_Many.webm`,
                    large: `${path}/Environment/Lighting/Bokeh/Bokeh_Orange_Large.webm`,
                },
                white: {
                    few: `${path}/Environment/Lighting/Bokeh/Bokeh_White_Few.webm`,
                    many: `${path}/Environment/Lighting/Bokeh/Bokeh_White_Many.webm`,
                    large: `${path}/Environment/Lighting/Bokeh/Bokeh_White_Large.webm`,
                },
            },
            glow: {
                stylized: {
                    circle: {
                        '01': {
                            green: `${path}/Environment/Lighting/Glow/Stylized/Glow_Stylized_Circle_01_Green.webm`,
                            orange: `${path}/Environment/Lighting/Glow/Stylized/Glow_Stylized_Circle_01_Orange.webm`,
                            teal: `${path}/Environment/Lighting/Glow/Stylized/Glow_Stylized_Circle_01_Teal.webm`,
                        },
                    },
                    pentagon: {
                        '01': {
                            green: `${path}/Environment/Lighting/Glow/Stylized/Glow_Stylized_Pentagon_01_Green.webm`,
                            orange: `${path}/Environment/Lighting/Glow/Stylized/Glow_Stylized_Pentagon_01_Orange.webm`,
                            teal: `${path}/Environment/Lighting/Glow/Stylized/Glow_Stylized_Pentagon_01_Teal.webm`,
                        },
                    },
                },
            },
            god_ray:{
                '01': {
                    purple: `${path}/Environment/Lighting/God_Ray/GodRay_01_Purple.webm`,
                    red: `${path}/Environment/Lighting/God_Ray/GodRay_01_Red.webm`,
                    white: `${path}/Environment/Lighting/God_Ray/GodRay_01_White.webm`,
                    yellow: `${path}/Environment/Lighting/God_Ray/GodRay_01_Yellow.webm`,
                },
            },
            shine: {
                '01': {
                    gold: `${path}/Environment/Lighting/Shine/Shine_01_Gold.webm`,
                    rainbow: `${path}/Environment/Lighting/Shine/Shine_01_Rainbow.webm`,
                }, 
            },
        },
        wisp: {
            '01': {
                blue: {
                    single: `${path}/Environment/Wisp/01/Environment_Wisp_01_Blue_Single.webm`,
                    few: `${path}/Environment/Wisp/01/Environment_Wisp_01_Blue_Few.webm`,
                },
                green: {
                    single: `${path}/Environment/Wisp/01/Environment_Wisp_01_Green_Single.webm`,
                    few: `${path}/Environment/Wisp/01/Environment_Wisp_01_Green_Few.webm`,
                },
                purple: {
                    single: `${path}/Environment/Wisp/01/Environment_Wisp_01_Purple_Single.webm`,
                    few: `${path}/Environment/Wisp/01/Environment_Wisp_01_Purple_Few.webm`,
                },
                teal: {
                    single: `${path}/Environment/Wisp/01/Environment_Wisp_01_Teal_Single.webm`,
                    few: `${path}/Environment/Wisp/01/Environment_Wisp_01_Teal_Few.webm`,
                },
            },
        },
    };
    //--------------------
    //FIRE
    //--------------------
    database.fire = {
        '01': {
            blue: `${path}/Fire/Fire_01/Fire_01_Blue.webm`,
            green: `${path}/Fire/Fire_01/Fire_01_Green.webm`,
            orange: `${path}/Fire/Fire_01/Fire_01_Orange.webm`,
            teal: `${path}/Fire/Fire_01/Fire_01_Teal.webm`,
            white: `${path}/Fire/Fire_01/Fire_01_White.webm`,
            colorless: `${path}/Fire/Fire_01/Fire_01_Colorless.webm`,
        },
        '02': {
            blue: `${path}/Fire/Fire_02/Fire_02_Blue.webm`,
            green: `${path}/Fire/Fire_02/Fire_02_Green.webm`,
            orange: `${path}/Fire/Fire_02/Fire_02_Orange.webm`,
            teal: `${path}/Fire/Fire_02/Fire_02_Teal.webm`,
            white: `${path}/Fire/Fire_02/Fire_02_White.webm`,
        },
        '03': {
            _markers: {
                loop: { start: 500, end: 1500 }
            },
            blue: `${path}/Fire/Fire_03/Fire_03_Blue.webm`,
            green: `${path}/Fire/Fire_03/Fire_03_Green.webm`,
            orange: `${path}/Fire/Fire_03/Fire_03_Orange.webm`,
            teal: `${path}/Fire/Fire_03/Fire_03_Teal.webm`,
            white: `${path}/Fire/Fire_03/Fire_03_White.webm`,
            redorange: `${path}/Fire/Fire_03/Fire_03_RedOrange.webm`,
        },
        fire_dragon: {
            _markers: {
                loop: { start: 1000, end: 5000 }    
            },
            '01': `${path}/Fire/Fire_Dragon/FireDragon_01.webm`,
        }
    };
    //--------------------
    //LIGHTNING
    //--------------------
    database.lightning = {
        '01': {
            blue: `${path}/Lightning/Lightning_01/Lightning_01_Blue.webm`,
            purple: `${path}/Lightning/Lightning_01/Lightning_01_Purple.webm`,
            teal: `${path}/Lightning/Lightning_01/Lightning_01_Teal.webm`,
            yellow: `${path}/Lightning/Lightning_01/Lightning_01_Yellow.webm`,
            colorless: `${path}/Lightning/Lightning_01/Lightning_01_Colorless.webm`,
        },
        '02': {
            blue: `${path}/Lightning/Lightning_02/Lightning_02_Blue.webm`,
            purple: `${path}/Lightning/Lightning_02/Lightning_02_Purple.webm`,
            teal: `${path}/Lightning/Lightning_02/Lightning_02_Teal.webm`,
            yellow: `${path}/Lightning/Lightning_02/Lightning_02_Yellow.webm`,
            colorless: `${path}/Lightning/Lightning_02/Lightning_02_Colorless.webm`,
        },
        '03': {
            blue: `${path}/Lightning/Lightning_03/Lightning_03_Blue.webm`,
            purple: `${path}/Lightning/Lightning_03/Lightning_03_Purple.webm`,
            teal: `${path}/Lightning/Lightning_03/Lightning_03_Teal.webm`,
            yellow: `${path}/Lightning/Lightning_03/Lightning_03_Yellow.webm`,
            colorless: `${path}/Lightning/Lightning_03/Lightning_03_Colorless.webm`,
        },
        '04': {
            blue: `${path}/Lightning/Lightning_04/Lightning_04_Blue.webm`,
            purple: `${path}/Lightning/Lightning_04/Lightning_04_Purple.webm`,
            teal: `${path}/Lightning/Lightning_04/Lightning_04_Teal.webm`,
            yellow: `${path}/Lightning/Lightning_04/Lightning_04_Yellow.webm`,
            colorless: `${path}/Lightning/Lightning_04/Lightning_04_Colorless.webm`,
        },
        lightning_bolt: {
            _template: 'line',
            blue: {
                '05ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Blue_05ft.webm`,
                '15ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Blue_15ft.webm`,
                '30ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Blue_30ft.webm`,
                '60ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Blue_60ft.webm`,
                '90ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Blue_90ft.webm`,
            },
            purple: {
                '05ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Purple_05ft.webm`,
                '15ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Purple_15ft.webm`,
                '30ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Purple_30ft.webm`,
                '60ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Purple_60ft.webm`,
                '90ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Purple_90ft.webm`,
            },
            teal: {
                '05ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Teal_05ft.webm`,
                '15ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Teal_15ft.webm`,
                '30ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Teal_30ft.webm`,
                '60ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Teal_60ft.webm`,
                '90ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Teal_90ft.webm`,
            },
            yellow: {
                '05ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Yellow_05ft.webm`,
                '15ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Yellow_15ft.webm`,
                '30ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Yellow_30ft.webm`,
                '60ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Yellow_60ft.webm`,
                '90ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Yellow_90ft.webm`,
            },
            colorless: {
                '05ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Colorless_05ft.webm`,
                '15ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Colorless_15ft.webm`,
                '30ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Colorless_30ft.webm`,
                '60ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Colorless_60ft.webm`,
                '90ft': `${path}/Lightning/Lightning_Bolt/Lightning_Bolt_Colorless_90ft.webm`,
            },
        },
    };
    //--------------------
    //NATURE
    //--------------------
    database.nature = {
        flower:{
            particle:{
                '01': {
                    blue: `${path}/Nature/Flower/Particle/Flower_Particle_01_Blue.webm`,
                    pink: `${path}/Nature/Flower/Particle/Flower_Particle_01_Pink.webm`,
                    red: `${path}/Nature/Flower/Particle/Flower_Particle_01_Red.webm`,
                    white: `${path}/Nature/Flower/Particle/Flower_Particle_01_White.webm`,
                },
            },
        },
    };
    //-------------------
    //OBJECTS
    //-------------------
    database.objects = {
        crashing_weapon: {
            _markers: {
                loop: { start: 1000, end: 4000 }    
            },
            sword: {
                yellow: {
                    '01': `${path}/Objects/Crashing_Weapon/Sword/Crashing_Weapon_Sword_01_Yellow.webm`,
                    '02': `${path}/Objects/Crashing_Weapon/Sword/Crashing_Weapon_Sword_02_Yellow.webm`,
                },
            },
        },
    };
    //--------------------
    //PARTICLE
    //--------------------
    database.particle = {
        '01': {
            one_shot: {
                blue: `${path}/Particle/Particle_01/OneShot/Particle_OneShot_01_Blue.webm`,
                green: `${path}/Particle/Particle_01/OneShot/Particle_OneShot_01_Green.webm`,
                orange: `${path}/Particle/Particle_01/OneShot/Particle_OneShot_01_Orange.webm`,
                red: `${path}/Particle/Particle_01/OneShot/Particle_OneShot_01_Red.webm`,
                white: `${path}/Particle/Particle_01/OneShot/Particle_OneShot_01_White.webm`,
            },
            loop: {
                blue: `${path}/Particle/Particle_01/Loop/Particle_Loop_01_Blue.webm`,
                green: `${path}/Particle/Particle_01/Loop/Particle_Loop_01_Green.webm`,
                orange: `${path}/Particle/Particle_01/Loop/Particle_Loop_01_Orange.webm`,
                red: `${path}/Particle/Particle_01/Loop/Particle_Loop_01_Red.webm`,
                white: `${path}/Particle/Particle_01/Loop/Particle_Loop_01_White.webm`,
            },
        },
        '02': {
           blue: `${path}/Particle/Particle_02/Particle_Loop_02_Blue.webm`, 
           green: `${path}/Particle/Particle_02/Particle_Loop_02_Green.webm`,
           orange: `${path}/Particle/Particle_02/Particle_Loop_02_Orange.webm`,
           red: `${path}/Particle/Particle_02/Particle_Loop_02_Red.webm`,
           white: `${path}/Particle/Particle_02/Particle_Loop_02_White.webm`,
        },
        '03': {
            blue: `${path}/Particle/Particle_03/Particle_03_Blue.webm`,
            green: `${path}/Particle/Particle_03/Particle_03_Green.webm`,
            orange: `${path}/Particle/Particle_03/Particle_03_Orange.webm`,
            red: `${path}/Particle/Particle_03/Particle_03_Red.webm`,
            white: `${path}/Particle/Particle_03/Particle_03_White.webm`,
        },
        '04': {
            blue: `${path}/Particle/Particle_04/Particle_04_Blue.webm`,
            green: `${path}/Particle/Particle_04/Particle_04_Green.webm`,
            orange: `${path}/Particle/Particle_04/Particle_04_Orange.webm`,
            red: `${path}/Particle/Particle_04/Particle_04_Red.webm`,
            white: `${path}/Particle/Particle_04/Particle_04_White.webm`,
        },
        '05': {
            blue: `${path}/Particle/Particle_05/Particle_05_Blue.webm`,
            green: `${path}/Particle/Particle_05/Particle_05_Green.webm`,
            orange: `${path}/Particle/Particle_05/Particle_05_Orange.webm`,
            red: `${path}/Particle/Particle_05/Particle_05_Red.webm`,
            white: `${path}/Particle/Particle_05/Particle_05_White.webm`,
        },
        '06': {
            blue: `${path}/Particle/Particle_06/Particle_06_Blue.webm`,
            green: `${path}/Particle/Particle_06/Particle_06_Green.webm`,
            orange: `${path}/Particle/Particle_06/Particle_06_Orange.webm`,
            red: `${path}/Particle/Particle_06/Particle_06_Red.webm`,
            white: `${path}/Particle/Particle_06/Particle_06_White.webm`,
        },
        '07': {
            blue: `${path}/Particle/Particle_07/Particle_07_Blue.webm`,
            green: `${path}/Particle/Particle_07/Particle_07_Green.webm`,
            orange: `${path}/Particle/Particle_07/Particle_07_Orange.webm`,
            red: `${path}/Particle/Particle_07/Particle_07_Red.webm`,
            white: `${path}/Particle/Particle_07/Particle_07_White.webm`,
        },
        '08': {
            blue: `${path}/Particle/Particle_08/Particle_08_Blue.webm`,
            green: `${path}/Particle/Particle_08/Particle_08_Green.webm`,
            orange: `${path}/Particle/Particle_08/Particle_08_Orange.webm`,
            red: `${path}/Particle/Particle_08/Particle_08_Red.webm`,
            white: `${path}/Particle/Particle_08/Particle_08_White.webm`,
        },
    };
    //--------------------
    //POISON
    //--------------------
    database.poison = {
        '01': {
            _markers: {
                loop: { start: 1500, end: 3000 }
            },
            green: {
                full: `${path}/Poison/01/Poison_01_Green.webm`,
                no_base: `${path}/Poison/01/Poison_01_Green_NoBase.webm`,
            },
            purple: {
                full: `${path}/Poison/01/Poison_01_Purple.webm`,
                no_base: `${path}/Poison/01/Poison_01_Purple_NoBase.webm`,
            },
            red: {
                full: `${path}/Poison/01/Poison_01_Red.webm`,
                no_base: `${path}/Poison/01/Poison_01_Red_NoBase.webm`,
            },
            teal: {
                full: `${path}/Poison/01/Poison_01_Teal.webm`,
                no_base: `${path}/Poison/01/Poison_01_Teal_NoBase.webm`,
            },
        },
        circle: {
            '01': {
                green: `${path}/Poison/Circle/Poison_Circle_01_Green.webm`,
                purple: `${path}/Poison/Circle/Poison_Circle_01_Purple.webm`,
                red: `${path}/Poison/Circle/Poison_Circle_01_Red.webm`,
                teal: `${path}/Poison/Circle/Poison_Circle_01_Teal.webm`,
                darkpurple: `${path}/Poison/Circle/Poison_Circle_01_Darkpurple.webm`,
            },
        },
        token_mask: {
            '01': {
                _markers: {
                    loop: { start: 1500, end: 3000 }
                },
                green: {
                    full: `${path}/Poison/Token_Mask/01/Poison_TokenMask_01_Green.webm`,
                    no_base: `${path}/Poison/Token_Mask/01/Poison_TokenMask_01_Green_NoBase.webm`,
                },
                purple: {
                    full: `${path}/Poison/Token_Mask/01/Poison_TokenMask_01_Purple.webm`,
                    no_base: `${path}/Poison/Token_Mask/01/Poison_TokenMask_01_Purple_NoBase.webm`,
                },
                red: {
                    full: `${path}/Poison/Token_Mask/01/Poison_TokenMask_01_Red.webm`,
                    no_base: `${path}/Poison/Token_Mask/01/Poison_TokenMask_01_Red_NoBase.webm`,
                },
                teal: {
                    full: `${path}/Poison/Token_Mask/01/Poison_TokenMask_01_Teal.webm`,
                    no_base: `${path}/Poison/Token_Mask/01/Poison_TokenMask_01_Teal_NoBase.webm`,
                },
            },
        },    
    };
    //--------------------
    //Pulse
    //--------------------
    database.pulse = {
        energy: {
            '01': {
                blue: `${path}/Pulse/Energy_01/Energy_Pulse_01_Blue.webm`,
                green: `${path}/Pulse/Energy_01/Energy_Pulse_01_Green.webm`,
                orange: `${path}/Pulse/Energy_01/Energy_Pulse_01_Orange.webm`,
                purple: `${path}/Pulse/Energy_01/Energy_Pulse_01_Purple.webm`,
                red: `${path}/Pulse/Energy_01/Energy_Pulse_01_Red.webm`,
                yellow: `${path}/Pulse/Energy_01/Energy_Pulse_01_Yellow.webm`,
            },
            '02': {
                fast: {
                    blue: `${path}/Pulse/Energy_02/Energy_Pulse_02_Blue_Fast.webm`,
                    green: `${path}/Pulse/Energy_02/Energy_Pulse_02_Green_Fast.webm`,
                    orange: `${path}/Pulse/Energy_02/Energy_Pulse_02_Orange_Fast.webm`,
                    purple: `${path}/Pulse/Energy_02/Energy_Pulse_02_Purple_Fast.webm`,
                    red: `${path}/Pulse/Energy_02/Energy_Pulse_02_Red_Fast.webm`,
                    yellow: `${path}/Pulse/Energy_02/Energy_Pulse_02_Yellow_Fast.webm`,
                    white: `${path}/Pulse/Energy_02/Energy_Pulse_02_White_Fast.webm`,
                },
                slow: {
                    blue: `${path}/Pulse/Energy_02/Energy_Pulse_02_Blue_Slow.webm`,
                    green: `${path}/Pulse/Energy_02/Energy_Pulse_02_Green_Slow.webm`,
                    orange: `${path}/Pulse/Energy_02/Energy_Pulse_02_Orange_Slow.webm`,
                    purple: `${path}/Pulse/Energy_02/Energy_Pulse_02_Purple_Slow.webm`,
                    red: `${path}/Pulse/Energy_02/Energy_Pulse_02_Red_Slow.webm`,
                    yellow: `${path}/Pulse/Energy_02/Energy_Pulse_02_Yellow_Slow.webm`,
                    white: `${path}/Pulse/Energy_02/Energy_Pulse_02_White_Slow.webm`,
                },
            },
            '03': {
                fast: {
                    blue: `${path}/Pulse/Energy_03/Energy_Pulse_03_Blue_Fast.webm`,
                    green: `${path}/Pulse/Energy_03/Energy_Pulse_03_Green_Fast.webm`,
                    orange: `${path}/Pulse/Energy_03/Energy_Pulse_03_Orange_Fast.webm`,
                    purple: `${path}/Pulse/Energy_03/Energy_Pulse_03_Purple_Fast.webm`,
                    red: `${path}/Pulse/Energy_03/Energy_Pulse_03_Red_Fast.webm`,
                    yellow: `${path}/Pulse/Energy_03/Energy_Pulse_03_Yellow_Fast.webm`,
                    white: `${path}/Pulse/Energy_03/Energy_Pulse_03_White_Fast.webm`,
                },
                slow: {
                    blue: `${path}/Pulse/Energy_03/Energy_Pulse_03_Blue_Slow.webm`,
                    green: `${path}/Pulse/Energy_03/Energy_Pulse_03_Green_Slow.webm`,
                    orange: `${path}/Pulse/Energy_03/Energy_Pulse_03_Orange_Slow.webm`,
                    purple: `${path}/Pulse/Energy_03/Energy_Pulse_03_Purple_Slow.webm`,
                    red: `${path}/Pulse/Energy_03/Energy_Pulse_03_Red_Slow.webm`,
                    yellow: `${path}/Pulse/Energy_03/Energy_Pulse_03_Yellow_Slow.webm`,
                    white: `${path}/Pulse/Energy_03/Energy_Pulse_03_White_Slow.webm`,
                },
            },
            '04': {
                blue: `${path}/Pulse/Energy_04/Energy_Pulse_04_Blue.webm`,
                yellow: `${path}/Pulse/Energy_04/Energy_Pulse_04_Yellow.webm`,
                white: `${path}/Pulse/Energy_04/Energy_Pulse_04_White.webm`,
            },
        },
    };
    //--------------------
    //SCREEN OVERLAY
    //--------------------
    database.screen_overlay = {
        bokeh:{
            gold: `${path}/Screen_Overlay/Bokeh/ScreenOverlay_Bokeh_Gold.webm`,
            orange: `${path}/Screen_Overlay/Bokeh/ScreenOverlay_Bokeh_Orange.webm`,
            white: `${path}/Screen_Overlay/Bokeh/ScreenOverlay_Bokeh_White.webm`,
        },
        cinema_bars: {
            _markers: {
                loop: { start: 2000, end: 4000 }    
            },
            '01': `${path}/Screen_Overlay/Cinema_Bars/Cinema_Bars.webm`,
            '02': `${path}/Screen_Overlay/Cinema_Bars/Cinema_Bars_Ultra_Wide.webm`,
        },
        embers: {
            '01': `${path}/Screen_Overlay/Embers/ScreenOverlay_Embers.webm`,
        },
        speed_lines: {
            center: {
                '01': {
                    black: `${path}/Screen_Overlay/Speed_Lines/SpeedLines_Black_01.webm`,
                    white: `${path}/Screen_Overlay/Speed_Lines/SpeedLines_White_01.webm`,
                },
                '02': {
                    black: `${path}/Screen_Overlay/Speed_Lines/SpeedLines_Black_02.webm`,
                    white: `${path}/Screen_Overlay/Speed_Lines/SpeedLines_White_02.webm`,
                },
            },
            horizontal: {
                '01': {
                    black: `${path}/Screen_Overlay/Speed_Lines/SpeedLines_Horizontal_Black_01.webm`,
                    white: `${path}/Screen_Overlay/Speed_Lines/SpeedLines_Horizontal_White_01.webm`,
                },
                '02': {
                    black: `${path}/Screen_Overlay/Speed_Lines/SpeedLines_Horizontal_Black_02.webm`,
                    white: `${path}/Screen_Overlay/Speed_Lines/SpeedLines_Horizontal_White_02.webm`,
                    bluepurple: `${path}/Screen_Overlay/Speed_Lines/SpeedLines_Horizontal_BluePurple_02.webm`,
                    redyellow: `${path}/Screen_Overlay/Speed_Lines/SpeedLines_Horizontal_RedYellow_02.webm`,
                },
            },
            vertical: {
                '01': {
                    black: `${path}/Screen_Overlay/Speed_Lines/SpeedLines_Vertical_Black_01.webm`,
                    white: `${path}/Screen_Overlay/Speed_Lines/SpeedLines_Vertical_White_01.webm`,
                },
                '02': {
                    black: `${path}/Screen_Overlay/Speed_Lines/SpeedLines_Vertical_Black_02.webm`,
                    white: `${path}/Screen_Overlay/Speed_Lines/SpeedLines_Vertical_White_02.webm`,
                    bluepurple: `${path}/Screen_Overlay/Speed_Lines/SpeedLines_Vertical_BluePurple_02.webm`,
                    redyellow: `${path}/Screen_Overlay/Speed_Lines/SpeedLines_Vertical_RedYellow_02.webm`,
                },
            },
        },
        wind_lines: {
            '01': { 
                white:`${path}/Screen_Overlay/Wind_Lines/ScreenOverlay_WindLines_01.webm`,
            },
            '02': {
                _markers: {
                    loop: { start: 500, end: 2500 }
                },
                white: `${path}/Screen_Overlay/Wind_Lines/ScreenOverlay_WindLines_02.webm`,
            },
        },
    };
    //--------------------
    //SLICE
    //--------------------
    database.slice = {
        '01': {
            black: {
                blue: `${path}/Slice/Slice_01/Slice_01_Black_Blue.webm`,
                green: `${path}/Slice/Slice_01/Slice_01_Black_Green.webm`,
                orange: `${path}/Slice/Slice_01/Slice_01_Black_Orange.webm`,
                purple: `${path}/Slice/Slice_01/Slice_01_Black_Purple.webm`,
                red: `${path}/Slice/Slice_01/Slice_01_Black_Red.webm`,
                yellow: `${path}/Slice/Slice_01/Slice_01_Black_Yellow.webm`,
                rainbow: `${path}/Slice/Slice_01/Slice_01_Black_Rainbow.webm`,
                colorless: `${path}/Slice/Slice_01/Slice_01_Black_Colorless.webm`,
            },
            color: {
                blue: `${path}/Slice/Slice_01/Slice_01_Color_Blue.webm`,
                green: `${path}/Slice/Slice_01/Slice_01_Color_Green.webm`,
                orange: `${path}/Slice/Slice_01/Slice_01_Color_Orange.webm`,
                purple: `${path}/Slice/Slice_01/Slice_01_Color_Purple.webm`,
                red: `${path}/Slice/Slice_01/Slice_01_Color_Red.webm`,
                yellow: `${path}/Slice/Slice_01/Slice_01_Color_Yellow.webm`,
                rainbow: `${path}/Slice/Slice_01/Slice_01_Color_Rainbow.webm`,
            },
            white: {
                blue: `${path}/Slice/Slice_01/Slice_01_White_Blue.webm`,
                green: `${path}/Slice/Slice_01/Slice_01_White_Green.webm`,
                orange: `${path}/Slice/Slice_01/Slice_01_White_Orange.webm`,
                purple: `${path}/Slice/Slice_01/Slice_01_White_Purple.webm`,
                red: `${path}/Slice/Slice_01/Slice_01_White_Red.webm`,
                yellow: `${path}/Slice/Slice_01/Slice_01_White_Yellow.webm`,
                rainbow: `${path}/Slice/Slice_01/Slice_01_White_Rainbow.webm`,
                colorless: `${path}/Slice/Slice_01/Slice_01_White_Colorless.webm`,
            },
        },
        '01_ranged': {
            _template: 'ranged',
            black: {
                blue: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Blue_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Blue_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Blue_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Blue_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Blue_90ft.webm`,
                },
                green: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Green_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Green_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Green_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Green_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Green_90ft.webm`,
                },
                orange: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Orange_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Orange_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Orange_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Orange_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Orange_90ft.webm`,
                },
                purple: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Purple_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Purple_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Purple_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Purple_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Purple_90ft.webm`,
                },
                red: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Red_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Red_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Red_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Red_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Red_90ft.webm`,
                },
                yellow: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Yellow_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Yellow_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Yellow_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Yellow_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Yellow_90ft.webm`, 
                },
                rainbow: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Rainbow_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Rainbow_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Rainbow_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Rainbow_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Rainbow_90ft.webm`,
                },
                colorless: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Colorless_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Colorless_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Colorless_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Colorless_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Black_Colorless_90ft.webm`,
                },
            },
            color: {
                blue: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Blue_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Blue_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Blue_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Blue_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Blue_90ft.webm`,
                },
                green: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Green_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Green_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Green_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Green_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Green_90ft.webm`,
                },
                orange: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Orange_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Orange_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Orange_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Orange_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Orange_90ft.webm`,
                },
                purple: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Purple_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Purple_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Purple_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Purple_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Purple_90ft.webm`,
                },
                red: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Red_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Red_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Red_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Red_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Red_90ft.webm`,
                },
                yellow: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Yellow_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Yellow_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Yellow_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Yellow_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Yellow_90ft.webm`,
                },
                rainbow: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Rainbow_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Rainbow_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Rainbow_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Rainbow_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_Color_Rainbow_90ft.webm`,
                },
            },
            white: {
                blue: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Blue_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Blue_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Blue_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Blue_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Blue_90ft.webm`,
                },
                green: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Green_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Green_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Green_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Green_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Green_90ft.webm`,
                },
                orange: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Orange_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Orange_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Orange_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Orange_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Orange_90ft.webm`,
                },
                purple: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Purple_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Purple_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Purple_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Purple_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Purple_90ft.webm`,
                },
                red: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Red_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Red_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Red_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Red_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Red_90ft.webm`,
                },
                yellow: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Yellow_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Yellow_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Yellow_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Yellow_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Yellow_90ft.webm`,
                },
                rainbow: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Rainbow_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Rainbow_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Rainbow_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Rainbow_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Rainbow_90ft.webm`,
                },
                colorless: {
                    '05ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Colorless_05ft.webm`,
                    '15ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Colorless_15ft.webm`,
                    '30ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Colorless_30ft.webm`,
                    '60ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Colorless_60ft.webm`,
                    '90ft': `${path}/Slice/Slice_01_Ranged/Slice_01_Ranged_White_Colorless_90ft.webm`,
                },                        
            },
        },
    };
    //--------------------
    //SMOKE
    //--------------------
    database.smoke = {
        '01': {
            green: `${path}/Smoke/Smoke_01/Smoke_01_Green.webm`,
            purple: `${path}/Smoke/Smoke_01/Smoke_01_Purple.webm`,
            black: `${path}/Smoke/Smoke_01/Smoke_01_Black.webm`,
            tan: `${path}/Smoke/Smoke_01/Smoke_01_Tan.webm`,
            white: `${path}/Smoke/Smoke_01/Smoke_01_White.webm`,
        },
        '02': {
            green: `${path}/Smoke/Smoke_02/Smoke_02_Green.webm`,
            purple: `${path}/Smoke/Smoke_02/Smoke_02_Purple.webm`,
            black: `${path}/Smoke/Smoke_02/Smoke_02_Black.webm`,
            tan: `${path}/Smoke/Smoke_02/Smoke_02_Tan.webm`,
            white: `${path}/Smoke/Smoke_02/Smoke_02_White.webm`,
        },
        '03': {
            green: `${path}/Smoke/Smoke_03/Smoke_03_Green.webm`,
            purple: `${path}/Smoke/Smoke_03/Smoke_03_Purple.webm`,
            black: `${path}/Smoke/Smoke_03/Smoke_03_Black.webm`,
            tan: `${path}/Smoke/Smoke_03/Smoke_03_Tan.webm`,
            white: `${path}/Smoke/Smoke_03/Smoke_03_White.webm`,
        },
        '04': {
            _markers: {
                loop: { start: 1000, end: 2000 }
            },
            green: `${path}/Smoke/Smoke_04/Smoke_04_Green.webm`,
            purple: `${path}/Smoke/Smoke_04/Smoke_04_Purple.webm`,
            black: `${path}/Smoke/Smoke_04/Smoke_04_Black.webm`,
            tan: `${path}/Smoke/Smoke_04/Smoke_04_Tan.webm`,
            white: `${path}/Smoke/Smoke_04/Smoke_04_White.webm`,
        },
        '05': {
            green: `${path}/Smoke/Smoke_05/Smoke_05_Green.webm`,
            purple: `${path}/Smoke/Smoke_05/Smoke_05_Purple.webm`,
            black: `${path}/Smoke/Smoke_05/Smoke_05_Black.webm`,
            tan: `${path}/Smoke/Smoke_05/Smoke_05_Tan.webm`,
            white: `${path}/Smoke/Smoke_05/Smoke_05_White.webm`,
        },
        '06': {
            green: `${path}/Smoke/Smoke_06/Smoke_06_Green.webm`,
            purple: `${path}/Smoke/Smoke_06/Smoke_06_Purple.webm`,
            black: `${path}/Smoke/Smoke_06/Smoke_06_Black.webm`,
            tan: `${path}/Smoke/Smoke_06/Smoke_06_Tan.webm`,
            white: `${path}/Smoke/Smoke_06/Smoke_06_White.webm`,
            greenblack: `${path}/Smoke/Smoke_06/Smoke_06_GreenBlack.webm`,
            purpleblack: `${path}/Smoke/Smoke_06/Smoke_06_PurpleBlack.webm`,
        },
        '07': {
            green: `${path}/Smoke/Smoke_07/Smoke_07_Green.webm`,
            purple: `${path}/Smoke/Smoke_07/Smoke_07_Purple.webm`,
            black: `${path}/Smoke/Smoke_07/Smoke_07_Black.webm`,
            tan: `${path}/Smoke/Smoke_07/Smoke_07_Tan.webm`,
            white: `${path}/Smoke/Smoke_07/Smoke_07_White.webm`,
        },
        token_mask: {
            '01': {
                blue: `${path}/Smoke/Token_Mask/Smoke_TokenMask_01_Blue.webm`,
                grey: `${path}/Smoke/Token_Mask/Smoke_TokenMask_01_Grey.webm`,
            },
        },
    };
    //--------------------
    //SOUND
    //--------------------
    database.sound = {
        roar: {
            '01': `${path}/Sound/Roar/Roar_01.webm`,
            '02': `${path}/Sound/Roar/Roar_02.webm`,
        },
    };
    //--------------------
    //STAR
    //--------------------
    database.star = {
        '01': {
            blue: `${path}/Star/Star_01/Star_01_Blue.webm`,
            green: `${path}/Star/Star_01/Star_01_Green.webm`,
            orange: `${path}/Star/Star_01/Star_01_Orange.webm`,
            purple: `${path}/Star/Star_01/Star_01_Purple.webm`,
            red: `${path}/Star/Star_01/Star_01_Red.webm`,
            yellow: `${path}/Star/Star_01/Star_01_Yellow.webm`,
            white: `${path}/Star/Star_01/Star_01_White.webm`,
            colorless: `${path}/Star/Star_01/Star_01_Colorless.webm`,
        },
        '02': {
            blue: `${path}/Star/Star_02/Star_02_Blue.webm`,
            green: `${path}/Star/Star_02/Star_02_Green.webm`,
            orange: `${path}/Star/Star_02/Star_02_Orange.webm`,
            purple: `${path}/Star/Star_02/Star_02_Purple.webm`,
            red: `${path}/Star/Star_02/Star_02_Red.webm`,
            yellow: `${path}/Star/Star_02/Star_02_Yellow.webm`,
            white: `${path}/Star/Star_02/Star_02_White.webm`,
            colorless: `${path}/Star/Star_02/Star_02_Colorless.webm`,
        },
        '03': {
            blue: `${path}/Star/Star_03/Star_03_Blue.webm`,
            green: `${path}/Star/Star_03/Star_03_Green.webm`,
            orange: `${path}/Star/Star_03/Star_03_Orange.webm`,
            purple: `${path}/Star/Star_03/Star_03_Purple.webm`,
            red: `${path}/Star/Star_03/Star_03_Red.webm`,
            yellow: `${path}/Star/Star_03/Star_03_Yellow.webm`,
            white: `${path}/Star/Star_03/Star_03_White.webm`,
        },
        shooting_star: {
            '01': {
                blue: `${path}/Star/Shooting_Star/Shooting_Star_01/Shooting_Star_01_Blue.webm`,
                purple: `${path}/Star/Shooting_Star/Shooting_Star_01/Shooting_Star_01_Purple.webm`,
                white: `${path}/Star/Shooting_Star/Shooting_Star_01/Shooting_Star_01_White.webm`,
                yellow: `${path}/Star/Shooting_Star/Shooting_Star_01/Shooting_Star_01_Yellow.webm`,
                colorless: `${path}/Star/Shooting_Star/Shooting_Star_01/Shooting_Star_01_Colorless.webm`,
            },
            '02': `${path}/Star/Shooting_Star/Shooting_Star_02/Shooting_Star_02.webm`,
        },
        twinkling_star: {
            '01': {
                blue: `${path}/Star/Twinkling_Star/Twinkling_Star_01/Twinkling_Star_01_Blue.webm`,
                green: `${path}/Star/Twinkling_Star/Twinkling_Star_01/Twinkling_Star_01_Green.webm`,
                orange: `${path}/Star/Twinkling_Star/Twinkling_Star_01/Twinkling_Star_01_Orange.webm`,
                purple: `${path}/Star/Twinkling_Star/Twinkling_Star_01/Twinkling_Star_01_Purple.webm`,
                red: `${path}/Star/Twinkling_Star/Twinkling_Star_01/Twinkling_Star_01_Red.webm`,
                white: `${path}/Star/Twinkling_Star/Twinkling_Star_01/Twinkling_Star_01_White.webm`,
                yellow: `${path}/Star/Twinkling_Star/Twinkling_Star_01/Twinkling_Star_01_Yellow.webm`,
                bluewhite: `${path}/Star/Twinkling_Star/Twinkling_Star_01/Twinkling_Star_01_BlueWhite.webm`,
                greenyellow: `${path}/Star/Twinkling_Star/Twinkling_Star_01/Twinkling_Star_01_GreenYellow.webm`,
                orangeyellow: `${path}/Star/Twinkling_Star/Twinkling_Star_01/Twinkling_Star_01_OrangeYellow.webm`,
                purpleyellow: `${path}/Star/Twinkling_Star/Twinkling_Star_01/Twinkling_Star_01_PurpleYellow.webm`,
                tealyellow: `${path}/Star/Twinkling_Star/Twinkling_Star_01/Twinkling_Star_01_TealYellow.webm`,
                yellowwhite: `${path}/Star/Twinkling_Star/Twinkling_Star_01/Twinkling_Star_01_YellowWhite.webm`,
                colorless: `${path}/Star/Twinkling_Star/Twinkling_Star_01/Twinkling_Star_01_Colorless.webm`,
            },
            '02': {
                blue: `${path}/Star/Twinkling_Star/Twinkling_Star_02/Twinkling_Star_02_Blue.webm`,
                green: `${path}/Star/Twinkling_Star/Twinkling_Star_02/Twinkling_Star_02_Green.webm`,
                orange: `${path}/Star/Twinkling_Star/Twinkling_Star_02/Twinkling_Star_02_Orange.webm`,
                purple: `${path}/Star/Twinkling_Star/Twinkling_Star_02/Twinkling_Star_02_Purple.webm`,
                red: `${path}/Star/Twinkling_Star/Twinkling_Star_02/Twinkling_Star_02_Red.webm`,
                yellow: `${path}/Star/Twinkling_Star/Twinkling_Star_02/Twinkling_Star_02_Yellow.webm`,
                white: `${path}/Star/Twinkling_Star/Twinkling_Star_02/Twinkling_Star_02_White.webm`,
                orangeyellow: `${path}/Star/Twinkling_Star/Twinkling_Star_02/Twinkling_Star_02_OrangeYellow.webm`,
                pinkyellow: `${path}/Star/Twinkling_Star/Twinkling_Star_02/Twinkling_Star_02_PinkYellow.webm`,
                tealyellow: `${path}/Star/Twinkling_Star/Twinkling_Star_02/Twinkling_Star_02_TealYellow.webm`,
                colorless: `${path}/Star/Twinkling_Star/Twinkling_Star_02/Twinkling_Star_02_Colorless.webm`,
            },
        },
    };
    //--------------------
    //SYMBOL   
    //--------------------
    database.symbol = {
        animal: {
            bear: {
                blue: `${path}/Symbol/Animal/Bear/Animal_Symbol_Bear_Blue.webm`,
                green: `${path}/Symbol/Animal/Bear/Animal_Symbol_Bear_Green.webm`,
                orange: `${path}/Symbol/Animal/Bear/Animal_Symbol_Bear_Orange.webm`,
                purple: `${path}/Symbol/Animal/Bear/Animal_Symbol_Bear_Purple.webm`,
                red: `${path}/Symbol/Animal/Bear/Animal_Symbol_Bear_Red.webm`,
                yellow: `${path}/Symbol/Animal/Bear/Animal_Symbol_Bear_Yellow.webm`,
            },
            eagle: {
                blue: `${path}/Symbol/Animal/Eagle/Animal_Symbol_Eagle_Blue.webm`,
                green: `${path}/Symbol/Animal/Eagle/Animal_Symbol_Eagle_Green.webm`,
                orange: `${path}/Symbol/Animal/Eagle/Animal_Symbol_Eagle_Orange.webm`,
                purple: `${path}/Symbol/Animal/Eagle/Animal_Symbol_Eagle_Purple.webm`,
                red: `${path}/Symbol/Animal/Eagle/Animal_Symbol_Eagle_Red.webm`,
                yellow: `${path}/Symbol/Animal/Eagle/Animal_Symbol_Eagle_Yellow.webm`,
            },
            elk: {
                blue: `${path}/Symbol/Animal/Elk/Animal_Symbol_Elk_Blue.webm`,
                green: `${path}/Symbol/Animal/Elk/Animal_Symbol_Elk_Green.webm`,
                orange: `${path}/Symbol/Animal/Elk/Animal_Symbol_Elk_Orange.webm`,
                purple: `${path}/Symbol/Animal/Elk/Animal_Symbol_Elk_Purple.webm`,
                red: `${path}/Symbol/Animal/Elk/Animal_Symbol_Elk_Red.webm`,
                yellow: `${path}/Symbol/Animal/Elk/Animal_Symbol_Elk_Yellow.webm`,
            },
            tiger: {
                blue: `${path}/Symbol/Animal/Tiger/Animal_Symbol_Tiger_Blue.webm`,
                green: `${path}/Symbol/Animal/Tiger/Animal_Symbol_Tiger_Green.webm`,
                orange: `${path}/Symbol/Animal/Tiger/Animal_Symbol_Tiger_Orange.webm`,
                purple: `${path}/Symbol/Animal/Tiger/Animal_Symbol_Tiger_Purple.webm`,
                red: `${path}/Symbol/Animal/Tiger/Animal_Symbol_Tiger_Red.webm`,
                yellow: `${path}/Symbol/Animal/Tiger/Animal_Symbol_Tiger_Yellow.webm`,
            },
            wolf: {
                blue: `${path}/Symbol/Animal/Wolf/Animal_Symbol_Wolf_Blue.webm`,
                green: `${path}/Symbol/Animal/Wolf/Animal_Symbol_Wolf_Green.webm`,
                orange: `${path}/Symbol/Animal/Wolf/Animal_Symbol_Wolf_Orange.webm`,
                purple: `${path}/Symbol/Animal/Wolf/Animal_Symbol_Wolf_Purple.webm`,
                red: `${path}/Symbol/Animal/Wolf/Animal_Symbol_Wolf_Red.webm`,
                yellow: `${path}/Symbol/Animal/Wolf/Animal_Symbol_Wolf_Yellow.webm`,
            },
        },
        eye: {
            '01': {
                _markers: {
                    loop: { start: 1033, end: 1967 }
                },
                blue: `${path}/Symbol/Eye/01/Symbol_Eye_01_Blue.webm`,
                green: `${path}/Symbol/Eye/01/Symbol_Eye_01_Green.webm`,
                orange: `${path}/Symbol/Eye/01/Symbol_Eye_01_Orange.webm`,
                purple: `${path}/Symbol/Eye/01/Symbol_Eye_01_Purple.webm`,
                red: `${path}/Symbol/Eye/01/Symbol_Eye_01_Red.webm`,
                yellow: `${path}/Symbol/Eye/01/Symbol_Eye_01_Yellow.webm`,
            },
        },
        skull: {
            poison: {
                _markers: {
                    loop: { start: 1033, end: 1967 }
                },
                green: `${path}/Symbol/Skull/Poison/Symbol_Skull_Poison_Green.webm`,
                purple: `${path}/Symbol/Skull/Poison/Symbol_Skull_Poison_Purple.webm`,
                red: `${path}/Symbol/Skull/Poison/Symbol_Skull_Poison_Red.webm`,
                teal: `${path}/Symbol/Skull/Poison/Symbol_Skull_Poison_Teal.webm`,
            },
        },
    };
    //--------------------
    //TEXTURE MASK
    //--------------------
    database.texture_mask = {
        energy: {
            '01': {
                blue: `${path}/Texture_Mask/Energy_Texture/Energy_Texture_01_Blue.webm`,
                green: `${path}/Texture_Mask/Energy_Texture/Energy_Texture_01_Green.webm`,
                orange: `${path}/Texture_Mask/Energy_Texture/Energy_Texture_01_Orange.webm`,
                purple: `${path}/Texture_Mask/Energy_Texture/Energy_Texture_01_Purple.webm`,
                red: `${path}/Texture_Mask/Energy_Texture/Energy_Texture_01_Red.webm`,
                white: `${path}/Texture_Mask/Energy_Texture/Energy_Texture_01_White.webm`,
                yellow: `${path}/Texture_Mask/Energy_Texture/Energy_Texture_01_Yellow.webm`,
            },           
        },
        glitter: {
            '01': {
                blue: {
                    full: `${path}/Texture_Mask/Glitter_Texture/Glitter_Texture_01_Blue.webm`,
                    particles_only: `${path}/Texture_Mask/Glitter_Texture/Glitter_Texture_01_Blue_Particles.webm`,
                },
                green: {
                    full: `${path}/Texture_Mask/Glitter_Texture/Glitter_Texture_01_Green.webm`,
                    particles_only: `${path}/Texture_Mask/Glitter_Texture/Glitter_Texture_01_Green_Particles.webm`,
                },
                orange: {
                    full: `${path}/Texture_Mask/Glitter_Texture/Glitter_Texture_01_Orange.webm`,
                    particles_only: `${path}/Texture_Mask/Glitter_Texture/Glitter_Texture_01_Orange_Particles.webm`,
                },
                purple: {
                    full: `${path}/Texture_Mask/Glitter_Texture/Glitter_Texture_01_Purple.webm`,
                    particles_only: `${path}/Texture_Mask/Glitter_Texture/Glitter_Texture_01_Purple_Particles.webm`,
                },
                red: {
                    full: `${path}/Texture_Mask/Glitter_Texture/Glitter_Texture_01_Red.webm`,
                    particles_only: `${path}/Texture_Mask/Glitter_Texture/Glitter_Texture_01_Red_Particles.webm`,
                },
                white: {
                    full: `${path}/Texture_Mask/Glitter_Texture/Glitter_Texture_01_White.webm`,
                    particles_only: `${path}/Texture_Mask/Glitter_Texture/Glitter_Texture_01_White_Particles.webm`,
                },
                yellow: {
                    full: `${path}/Texture_Mask/Glitter_Texture/Glitter_Texture_01_Yellow.webm`,
                    particles_only: `${path}/Texture_Mask/Glitter_Texture/Glitter_Texture_01_Yellow_Particles.webm`,
                },
                blue_white: {
                    full: `${path}/Texture_Mask/Glitter_Texture/Glitter_Texture_01_BlueWhite.webm`,
                },
                green_yellow: {
                    full: `${path}/Texture_Mask/Glitter_Texture/Glitter_Texture_01_GreenYellow.webm`,
                },
                purple_yellow: {
                    full: `${path}/Texture_Mask/Glitter_Texture/Glitter_Texture_01_PurpleYellow.webm`,
                },
            },
        },
        ink: {
            '01': {
                _markers: {
                    loop: { start: 3000, end: 6000 }
                },
                black: `${path}/Texture_Mask/Ink_Texture/Ink_Texture_01_Black.webm`,
            },
        },
        tile_base: {
            burn: {
                '01': {
                    fast: `${path}/Texture_Mask/Tile_Base/Burn/Tile_Base_Burn_01_Fast.webm`,
                    normal: `${path}/Texture_Mask/Tile_Base/Burn/Tile_Base_Burn_01_Normal.webm`,
                    slow: `${path}/Texture_Mask/Tile_Base/Burn/Tile_Base_Burn_01_Slow.webm`,
                },
                '02': {
                    fast: `${path}/Texture_Mask/Tile_Base/Burn/Tile_Base_Burn_02_Fast.webm`,
                    normal: `${path}/Texture_Mask/Tile_Base/Burn/Tile_Base_Burn_02_Normal.webm`,
                    slow: `${path}/Texture_Mask/Tile_Base/Burn/Tile_Base_Burn_02_Slow.webm`,
                },
                '03': {
                    fast: `${path}/Texture_Mask/Tile_Base/Burn/Tile_Base_Burn_03_Fast.webm`,
                    normal: `${path}/Texture_Mask/Tile_Base/Burn/Tile_Base_Burn_03_Normal.webm`,
                    slow: `${path}/Texture_Mask/Tile_Base/Burn/Tile_Base_Burn_03_Slow.webm`,
                },
            },
            shatter: {
                center: {
                    '01': `${path}/Texture_Mask/Tile_Base/Shatter/Tile_Base_Shatter_Center_01.webm`,
                },
                side: {
                    '01': `${path}/Texture_Mask/Tile_Base/Shatter/Tile_Base_Shatter_Side_01.webm`,
                },
            },
            smoke: {
                '01': `${path}/Texture_Mask/Tile_Base/Smoke/Tile_Base_Smoke_01.webm`,
            },
            tear: {
                '01': `${path}/Texture_Mask/Tile_Base/Tear/Tile_Base_Tear_01.webm`,
            },
        },
    };
    //--------------------
    //TRAIL
    //--------------------
    database.trail = {
        token: {
            generic: {
                _markers: {
                    loop: { start: 250, end: 750 }
                },
                '01': {
                    blue: `${path}/Trail/Token/Generic/Trail_Token_Generic_01_Blue.webm`,
                    green: `${path}/Trail/Token/Generic/Trail_Token_Generic_01_Green.webm`,
                    orange: `${path}/Trail/Token/Generic/Trail_Token_Generic_01_Orange.webm`,
                    purple: `${path}/Trail/Token/Generic/Trail_Token_Generic_01_Purple.webm`,
                    red: `${path}/Trail/Token/Generic/Trail_Token_Generic_01_Red.webm`,
                    yellow: `${path}/Trail/Token/Generic/Trail_Token_Generic_01_Yellow.webm`,
                    black: `${path}/Trail/Token/Generic/Trail_Token_Generic_01_Black.webm`,
                    white: `${path}/Trail/Token/Generic/Trail_Token_Generic_01_White.webm`,
                    rainbow: `${path}/Trail/Token/Generic/Trail_Token_Generic_01_Rainbow.webm`,
                },
                '02': {
                    blue: `${path}/Trail/Token/Generic/Trail_Token_Generic_02_Blue.webm`,
                    green: `${path}/Trail/Token/Generic/Trail_Token_Generic_02_Green.webm`,
                    orange: `${path}/Trail/Token/Generic/Trail_Token_Generic_02_Orange.webm`,
                    purple: `${path}/Trail/Token/Generic/Trail_Token_Generic_02_Purple.webm`,
                    red: `${path}/Trail/Token/Generic/Trail_Token_Generic_02_Red.webm`,
                    yellow: `${path}/Trail/Token/Generic/Trail_Token_Generic_02_Yellow.webm`,
                    black: `${path}/Trail/Token/Generic/Trail_Token_Generic_02_Black.webm`,
                    white: `${path}/Trail/Token/Generic/Trail_Token_Generic_02_White.webm`,
                    rainbow: `${path}/Trail/Token/Generic/Trail_Token_Generic_02_Rainbow.webm`,
                },
            },
        },
    };
    //--------------------
    //VELOCITY 
    //--------------------
    database.velocity = {
        '01': {
            white: `${path}/Velocity/Velocity_01_White.webm`,
        },
        '02': {
            _markers: {
                loop: { start: 500, end: 1500 }
            },            
            white: `${path}/Velocity/Velocity_02_White.webm`,
        },
    };
    //--------------------
    //WINGS
    //--------------------
    database.wings = {
        angel: {
            '01': `${path}/Wings/Wings_Angel_01.webm`,
        },
        bird: {
            '01': `${path}/Wings/Wings_Bird_01.webm`,
            '02': `${path}/Wings/Wings_Bird_02.webm`,
        },
        devil: {
            '01': `${path}/Wings/Wings_Devil_01.webm`,
        },
        one_wing: {
            angel: {
                '01': `${path}/Wings/One_Wing/Wings_OneWing_Angel_01.webm`,
            },
            bird: {
                '01': `${path}/Wings/One_Wing/Wings_OneWing_Bird_01.webm`,
                '02': `${path}/Wings/One_Wing/Wings_OneWing_Bird_02.webm`,
            },
            devil: {
                '01': `${path}/Wings/One_Wing/Wings_OneWing_Devil_01.webm`,
            },
        },
    };
    //--------------------
    //WOUNDS
    //--------------------
    database.wounds = {
        cut: {
            _markers: {
                loop: { start: 2000, end: 2500 }    
            },
            '01': `${path}/Wounds/Cut/Cut_01.webm`,
            '02': `${path}/Wounds/Cut/Cut_02.webm`,
        },
        token_mask: {
            shatter: {
                center: {
                    '01': {
                        blue: {
                            full: `${path}/Wounds/Token_Mask/Shatter/Center/Wounds_TokenMask_Shatter_Center_01_Blue.webm`,
                            no_base: `${path}/Wounds/Token_Mask/Shatter/Center/Wounds_TokenMask_Shatter_Center_01_Blue_NoBase.webm`,
                        },
                        red: {
                            full: `${path}/Wounds/Token_Mask/Shatter/Center/Wounds_TokenMask_Shatter_Center_01_Red.webm`,
                            no_base: `${path}/Wounds/Token_Mask/Shatter/Center/Wounds_TokenMask_Shatter_Center_01_Red_NoBase.webm`,
                        },
                        white: {
                            full: `${path}/Wounds/Token_Mask/Shatter/Center/Wounds_TokenMask_Shatter_Center_01_White.webm`,
                            no_base: `${path}/Wounds/Token_Mask/Shatter/Center/Wounds_TokenMask_Shatter_Center_01_White_NoBase.webm`,
                        },
                    },
                },
                side: {
                    '01': {
                        blue: {
                            full: `${path}/Wounds/Token_Mask/Shatter/Side/Wounds_TokenMask_Shatter_Side_01_Blue.webm`,
                            no_base: `${path}/Wounds/Token_Mask/Shatter/Side/Wounds_TokenMask_Shatter_Side_01_Blue_NoBase.webm`,
                        },
                        red: {
                            full: `${path}/Wounds/Token_Mask/Shatter/Side/Wounds_TokenMask_Shatter_Side_01_Red.webm`,
                            no_base: `${path}/Wounds/Token_Mask/Shatter/Side/Wounds_TokenMask_Shatter_Side_01_Red_NoBase.webm`,
                        },
                        white: {
                            full: `${path}/Wounds/Token_Mask/Shatter/Side/Wounds_TokenMask_Shatter_Side_01_White.webm`,
                            no_base: `${path}/Wounds/Token_Mask/Shatter/Side/Wounds_TokenMask_Shatter_Side_01_White_NoBase.webm`,
                        },
                    },
                },
            },
            tear: {
                '01': {
                    green: {
                        full: `${path}/Wounds/Token_Mask/Tear/Wounds_TokenMask_Tear_01_Green.webm`,
                        no_base: `${path}/Wounds/Token_Mask/Tear/Wounds_TokenMask_Tear_01_Green_NoBase.webm`,
                    },
                    purple: {
                        full: `${path}/Wounds/Token_Mask/Tear/Wounds_TokenMask_Tear_01_Purple.webm`,
                        no_base: `${path}/Wounds/Token_Mask/Tear/Wounds_TokenMask_Tear_01_Purple_NoBase.webm`,
                    },
                    red: {
                        full: `${path}/Wounds/Token_Mask/Tear/Wounds_TokenMask_Tear_01_Red.webm`,
                        no_base: `${path}/Wounds/Token_Mask/Tear/Wounds_TokenMask_Tear_01_Red_NoBase.webm`,
                    },
                },
            },
        },
    };

}