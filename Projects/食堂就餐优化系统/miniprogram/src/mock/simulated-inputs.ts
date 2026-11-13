// 本文件由 tools/miniprogram/gen-sim-inputs.mjs 自动生成，请勿手工修改。
// 来源：Resources/报告/T02-DSH-接入前定点修正-证据-v2/inputs/
// 模拟数据（SIMULATED）：不是真实菜单，营养值为估算占位；仅用于阶段 B 业务接入联调验证。
// T06a 适配：request 内旧 plannerConfig.limits（maxCandidates/maxNodes）统一改为冻结契约四字段
// {maxMealCandidatesPerMeal,maxDpStates,maxSearchNodes,wallClockMs}；T02 源文件与 sha256 保持原样。

export interface FixtureCase {
  key: string;
  name: string;
  description: string;
  file: string;
  /** T02 源夹具文件身份（源文件未改；request 内 limits 已由 T06a 适配为契约四字段）。 */
  sha256: string;
  request: any;
}

export const FIXTURE_CASES: Record<string, FixtureCase> = {
  success: {
    key: 'success',
    name: '成功方案 (OkPartial)',
    description: '常规贪心规划成功；因模拟数据为估算值故带 ESTIMATED_DATA 标志且状态为 OkPartial',
    file: "plan-request-success.json",
    sha256: "8550B22BC3E9B3F87A135FB962ED54AE01D7F431B37472DCEF0AF57BFDE5D617",
    request: {
  "contractVersion": "1.0",
  "requestId": "req-v2-success",
  "businessDate": "2026-10-20",
  "tzOffsetMinutes": 480,
  "_note": "SIMULATED fixture for T02 v2 targeted fixes. Not real menu or nutrition acceptance.",
  "profile": {
    "contractVersion": "1.0",
    "profileId": "p-v2-male",
    "revision": 1,
    "sex": "male",
    "ageYears": 20,
    "heightMm": 1750,
    "weightGrams": 70000,
    "bodyFatPermille": null,
    "activityLevel": "moderate",
    "goal": {
      "type": "fatLoss",
      "manualTargets": null
    },
    "trainingPreference": false,
    "dietaryFlags": {
      "pregnancyOrLactation": false,
      "medicalDietManagement": false
    },
    "tastes": []
  },
  "catalog": {
    "contractVersion": "1.0",
    "menuVersion": "menu-simulated-v2",
    "catalogHash": "sha256:40f2bd13ef5b91317e4cfcbbd868c82e208cb1347773a60e238bfea5c6cfba76",
    "canteen": {
      "canteenId": "canteen-sim",
      "name": "模拟食堂（非真实菜单）"
    },
    "windows": [
      {
        "windowId": "w-main",
        "name": "模拟主窗口",
        "mealWindows": [
          "breakfast",
          "lunch",
          "dinner"
        ]
      }
    ],
    "dishes": [
      {
        "dishId": "dish-rice",
        "name": "米饭",
        "kind": "single",
        "category": "staple",
        "riceDish": true,
        "riceIncluded": false,
        "nutrition": {
          "energyKcal": 232,
          "proteinDg": 44,
          "fatDg": 6,
          "carbDg": 516
        },
        "nutritionBasis": {
          "source": "simulated-reference",
          "portionAssumption": "模拟 200g 熟米饭",
          "estimated": true,
          "note": "SIMULATED"
        }
      },
      {
        "dishId": "dish-mantou",
        "name": "馒头",
        "kind": "single",
        "category": "staple",
        "riceDish": false,
        "riceIncluded": false,
        "nutrition": {
          "energyKcal": 220,
          "proteinDg": 70,
          "fatDg": 10,
          "carbDg": 470
        },
        "nutritionBasis": {
          "source": "simulated-reference",
          "portionAssumption": "模拟 100g 馒头",
          "estimated": true,
          "note": "SIMULATED"
        }
      },
      {
        "dishId": "dish-chicken",
        "name": "清蒸鸡胸",
        "kind": "single",
        "category": "protein",
        "riceDish": false,
        "riceIncluded": false,
        "nutrition": {
          "energyKcal": 165,
          "proteinDg": 310,
          "fatDg": 36,
          "carbDg": 0
        },
        "nutritionBasis": {
          "source": "simulated-reference",
          "portionAssumption": "模拟 100g 熟鸡胸",
          "estimated": true,
          "note": "SIMULATED"
        }
      },
      {
        "dishId": "dish-greens",
        "name": "清炒青菜",
        "kind": "single",
        "category": "vegetable",
        "riceDish": false,
        "riceIncluded": false,
        "nutrition": {
          "energyKcal": 80,
          "proteinDg": 20,
          "fatDg": 50,
          "carbDg": 60
        },
        "nutritionBasis": {
          "source": "simulated-reference",
          "portionAssumption": "模拟 150g 炒青菜",
          "estimated": true,
          "note": "SIMULATED"
        }
      }
    ],
    "offers": [
      {
        "offerId": "offer-rice-full",
        "dishId": "dish-rice",
        "windowId": "w-main",
        "mealWindows": [
          "breakfast",
          "lunch",
          "dinner"
        ],
        "portionCode": "full",
        "portionRatioNum": 1,
        "portionRatioDen": 1,
        "priceCents": 100,
        "priceBasis": "unitPrice"
      },
      {
        "offerId": "offer-rice-half",
        "dishId": "dish-rice",
        "windowId": "w-main",
        "mealWindows": [
          "breakfast",
          "lunch",
          "dinner"
        ],
        "portionCode": "half",
        "portionRatioNum": 1,
        "portionRatioDen": 2,
        "priceCents": 100,
        "priceBasis": "unitPrice"
      },
      {
        "offerId": "offer-mantou",
        "dishId": "dish-mantou",
        "windowId": "w-main",
        "mealWindows": [
          "breakfast"
        ],
        "portionCode": "full",
        "portionRatioNum": 1,
        "portionRatioDen": 1,
        "priceCents": 100,
        "priceBasis": "unitPrice"
      },
      {
        "offerId": "offer-chicken",
        "dishId": "dish-chicken",
        "windowId": "w-main",
        "mealWindows": [
          "lunch",
          "dinner"
        ],
        "portionCode": "full",
        "portionRatioNum": 1,
        "portionRatioDen": 1,
        "priceCents": 800,
        "priceBasis": "unitPrice"
      },
      {
        "offerId": "offer-greens",
        "dishId": "dish-greens",
        "windowId": "w-main",
        "mealWindows": [
          "lunch",
          "dinner"
        ],
        "portionCode": "full",
        "portionRatioNum": 1,
        "portionRatioDen": 1,
        "priceCents": 400,
        "priceBasis": "unitPrice"
      }
    ],
    "comboRules": []
  },
  "nutritionConfig": {
    "version": "nutrition-v1.2-candidate",
    "hash": "sha256:c93d2d91b13e54466e89d7d41ec50b1d93b6566cdee699af0cb81154a72dd288",
    "formula": "mifflin-st-jeor",
    "parameters": {
      "fatLossDeficitPermille": 100,
      "fatLossDeficitCapKcal": 300,
      "activityFactorPermille": {
        "sedentary": 1200,
        "light": 1375,
        "moderate": 1550,
        "active": 1725,
        "veryActive": 1900
      },
      "proteinMgPerKgNormal": 1200,
      "proteinMgPerKgTrainingPreference": 1500,
      "fatEnergyPermille": 270,
      "mealSharePermille": {
        "breakfast": 300,
        "lunch": 400,
        "dinner": 300
      }
    },
    "population": {
      "ageMinYears": 18,
      "ageMaxYears": 78,
      "pregnancyOrLactationPolicy": "disableAutoTargetsAndAutoPlanning",
      "medicalDietPolicy": "disableAutoTargetsAndAutoPlanning"
    },
    "macroThresholds": {
      "adult19To78": {
        "proteinBp": [
          1000,
          3500
        ],
        "fatBp": [
          2000,
          3500
        ],
        "carbBp": [
          4500,
          6500
        ],
        "carbFloorGPerDay": 130
      },
      "age18": {
        "proteinBp": [
          1000,
          3000
        ],
        "fatBp": [
          2500,
          3500
        ],
        "carbBp": [
          4500,
          6500
        ],
        "carbFloorGPerDay": null
      }
    },
    "energyFloor": {
      "maleKcalPerDay": 1500,
      "femaleKcalPerDay": 1200
    },
    "manualTargetRules": {
      "sourceTypes": [
        "professional",
        "userEntered"
      ],
      "tolerance": "max(20kcal,2%)",
      "derivedFieldsAllowed": true
    },
    "plannerSorting": {
      "nutritionDeviationWeightsPermille": {
        "energy": 250,
        "protein": 250,
        "fat": 250,
        "carb": 250
      },
      "nutritionTierWidthBp": 1000
    }
  },
  "plannerConfig": {
    "algorithm": "greedy",
    "strategies": [
      "primary",
      "economy",
      "taste"
    ],
    "budgetCents": 3000,
    "maxItemsPerMeal": 3,
    "limits": {
      "maxMealCandidatesPerMeal": 64,
      "maxDpStates": 20000,
      "maxSearchNodes": 200000,
      "wallClockMs": null
    }
  },
  "planningMeals": [
    "breakfast",
    "lunch",
    "dinner"
  ],
  "state": {
    "soldOut": [],
    "windowLocks": [],
    "itemLocks": [],
    "endedMeals": [],
    "activeLogs": []
  }
},
  },
  targetUnavailable: {
    key: 'targetUnavailable',
    name: '目标不可用 (TargetUnavailable)',
    description: 'BMI 过轻且未设手动目标，自动目标停用，返回 TargetUnavailable 且 plans 为空',
    file: "plan-request-target-unavailable.json",
    sha256: "07FF8CBD530A3B14E9B9AAAEB39AE81CA0C3C8698BDAAA36D1EB50613CC15C7F",
    request: {
  "contractVersion": "1.0",
  "requestId": "req-v2-target-unavailable",
  "businessDate": "2026-10-20",
  "tzOffsetMinutes": 480,
  "_note": "SIMULATED fixture for T02 v2 targeted fixes. Not real menu or nutrition acceptance. Scenario: pregnancyOrLactation risk flag disables auto target, so PlanDay must return TargetUnavailable instead of plans.",
  "profile": {
    "contractVersion": "1.0",
    "profileId": "p-v2-risk",
    "revision": 1,
    "sex": "female",
    "ageYears": 20,
    "heightMm": 1750,
    "weightGrams": 70000,
    "bodyFatPermille": null,
    "activityLevel": "moderate",
    "goal": {
      "type": "fatLoss",
      "manualTargets": null
    },
    "trainingPreference": false,
    "dietaryFlags": {
      "pregnancyOrLactation": true,
      "medicalDietManagement": false
    },
    "tastes": []
  },
  "catalog": {
    "contractVersion": "1.0",
    "menuVersion": "menu-simulated-v2",
    "catalogHash": "sha256:40f2bd13ef5b91317e4cfcbbd868c82e208cb1347773a60e238bfea5c6cfba76",
    "canteen": {
      "canteenId": "canteen-sim",
      "name": "模拟食堂（非真实菜单）"
    },
    "windows": [
      {
        "windowId": "w-main",
        "name": "模拟主窗口",
        "mealWindows": [
          "breakfast",
          "lunch",
          "dinner"
        ]
      }
    ],
    "dishes": [
      {
        "dishId": "dish-rice",
        "name": "米饭",
        "kind": "single",
        "category": "staple",
        "riceDish": true,
        "riceIncluded": false,
        "nutrition": {
          "energyKcal": 232,
          "proteinDg": 44,
          "fatDg": 6,
          "carbDg": 516
        },
        "nutritionBasis": {
          "source": "simulated-reference",
          "portionAssumption": "模拟 200g 熟米饭",
          "estimated": true,
          "note": "SIMULATED"
        }
      },
      {
        "dishId": "dish-mantou",
        "name": "馒头",
        "kind": "single",
        "category": "staple",
        "riceDish": false,
        "riceIncluded": false,
        "nutrition": {
          "energyKcal": 220,
          "proteinDg": 70,
          "fatDg": 10,
          "carbDg": 470
        },
        "nutritionBasis": {
          "source": "simulated-reference",
          "portionAssumption": "模拟 100g 馒头",
          "estimated": true,
          "note": "SIMULATED"
        }
      },
      {
        "dishId": "dish-chicken",
        "name": "清蒸鸡胸",
        "kind": "single",
        "category": "protein",
        "riceDish": false,
        "riceIncluded": false,
        "nutrition": {
          "energyKcal": 165,
          "proteinDg": 310,
          "fatDg": 36,
          "carbDg": 0
        },
        "nutritionBasis": {
          "source": "simulated-reference",
          "portionAssumption": "模拟 100g 熟鸡胸",
          "estimated": true,
          "note": "SIMULATED"
        }
      },
      {
        "dishId": "dish-greens",
        "name": "清炒青菜",
        "kind": "single",
        "category": "vegetable",
        "riceDish": false,
        "riceIncluded": false,
        "nutrition": {
          "energyKcal": 80,
          "proteinDg": 20,
          "fatDg": 50,
          "carbDg": 60
        },
        "nutritionBasis": {
          "source": "simulated-reference",
          "portionAssumption": "模拟 150g 炒青菜",
          "estimated": true,
          "note": "SIMULATED"
        }
      }
    ],
    "offers": [
      {
        "offerId": "offer-rice-full",
        "dishId": "dish-rice",
        "windowId": "w-main",
        "mealWindows": [
          "breakfast",
          "lunch",
          "dinner"
        ],
        "portionCode": "full",
        "portionRatioNum": 1,
        "portionRatioDen": 1,
        "priceCents": 100,
        "priceBasis": "unitPrice"
      },
      {
        "offerId": "offer-rice-half",
        "dishId": "dish-rice",
        "windowId": "w-main",
        "mealWindows": [
          "breakfast",
          "lunch",
          "dinner"
        ],
        "portionCode": "half",
        "portionRatioNum": 1,
        "portionRatioDen": 2,
        "priceCents": 100,
        "priceBasis": "unitPrice"
      },
      {
        "offerId": "offer-mantou",
        "dishId": "dish-mantou",
        "windowId": "w-main",
        "mealWindows": [
          "breakfast"
        ],
        "portionCode": "full",
        "portionRatioNum": 1,
        "portionRatioDen": 1,
        "priceCents": 100,
        "priceBasis": "unitPrice"
      },
      {
        "offerId": "offer-chicken",
        "dishId": "dish-chicken",
        "windowId": "w-main",
        "mealWindows": [
          "lunch",
          "dinner"
        ],
        "portionCode": "full",
        "portionRatioNum": 1,
        "portionRatioDen": 1,
        "priceCents": 800,
        "priceBasis": "unitPrice"
      },
      {
        "offerId": "offer-greens",
        "dishId": "dish-greens",
        "windowId": "w-main",
        "mealWindows": [
          "lunch",
          "dinner"
        ],
        "portionCode": "full",
        "portionRatioNum": 1,
        "portionRatioDen": 1,
        "priceCents": 400,
        "priceBasis": "unitPrice"
      }
    ],
    "comboRules": []
  },
  "nutritionConfig": {
    "version": "nutrition-v1.2-candidate",
    "hash": "sha256:c93d2d91b13e54466e89d7d41ec50b1d93b6566cdee699af0cb81154a72dd288",
    "formula": "mifflin-st-jeor",
    "parameters": {
      "fatLossDeficitPermille": 100,
      "fatLossDeficitCapKcal": 300,
      "activityFactorPermille": {
        "sedentary": 1200,
        "light": 1375,
        "moderate": 1550,
        "active": 1725,
        "veryActive": 1900
      },
      "proteinMgPerKgNormal": 1200,
      "proteinMgPerKgTrainingPreference": 1500,
      "fatEnergyPermille": 270,
      "mealSharePermille": {
        "breakfast": 300,
        "lunch": 400,
        "dinner": 300
      }
    },
    "population": {
      "ageMinYears": 18,
      "ageMaxYears": 78,
      "pregnancyOrLactationPolicy": "disableAutoTargetsAndAutoPlanning",
      "medicalDietPolicy": "disableAutoTargetsAndAutoPlanning"
    },
    "macroThresholds": {
      "adult19To78": {
        "proteinBp": [
          1000,
          3500
        ],
        "fatBp": [
          2000,
          3500
        ],
        "carbBp": [
          4500,
          6500
        ],
        "carbFloorGPerDay": 130
      },
      "age18": {
        "proteinBp": [
          1000,
          3000
        ],
        "fatBp": [
          2500,
          3500
        ],
        "carbBp": [
          4500,
          6500
        ],
        "carbFloorGPerDay": null
      }
    },
    "energyFloor": {
      "maleKcalPerDay": 1500,
      "femaleKcalPerDay": 1200
    },
    "manualTargetRules": {
      "sourceTypes": [
        "professional",
        "userEntered"
      ],
      "tolerance": "max(20kcal,2%)",
      "derivedFieldsAllowed": true
    },
    "plannerSorting": {
      "nutritionDeviationWeightsPermille": {
        "energy": 250,
        "protein": 250,
        "fat": 250,
        "carb": 250
      },
      "nutritionTierWidthBp": 1000
    }
  },
  "plannerConfig": {
    "algorithm": "greedy",
    "strategies": [
      "primary",
      "economy",
      "taste"
    ],
    "budgetCents": 3000,
    "maxItemsPerMeal": 3,
    "limits": {
      "maxMealCandidatesPerMeal": 64,
      "maxDpStates": 20000,
      "maxSearchNodes": 200000,
      "wallClockMs": null
    }
  },
  "planningMeals": [
    "breakfast",
    "lunch",
    "dinner"
  ],
  "state": {
    "soldOut": [],
    "windowLocks": [],
    "itemLocks": [],
    "endedMeals": [],
    "activeLogs": []
  }
},
  },
  invalid: {
    key: 'invalid',
    name: '非法输入 (INVALID_INPUT)',
    description: 'maxItemsPerMeal=99 超出限制，契约错误包络返回 INVALID_INPUT',
    file: "plan-request-invalid.json",
    sha256: "23078623F54B16A36ED5DBAA7E9F967C76A0C6DB8E21ACAA6E1049C37E3C6178",
    request: {
  "contractVersion": "1.0",
  "requestId": "req-v2-invalid",
  "businessDate": "2026-10-20",
  "tzOffsetMinutes": 480,
  "_note": "SIMULATED fixture for T02 v2 targeted fixes. Not real menu or nutrition acceptance. Scenario: plannerConfig.maxItemsPerMeal=99 is outside the contract range, so the core must return a visible INVALID_INPUT envelope and never a fake plan.",
  "profile": {
    "contractVersion": "1.0",
    "profileId": "p-v2-male",
    "revision": 1,
    "sex": "male",
    "ageYears": 20,
    "heightMm": 1750,
    "weightGrams": 70000,
    "bodyFatPermille": null,
    "activityLevel": "moderate",
    "goal": {
      "type": "fatLoss",
      "manualTargets": null
    },
    "trainingPreference": false,
    "dietaryFlags": {
      "pregnancyOrLactation": false,
      "medicalDietManagement": false
    },
    "tastes": []
  },
  "catalog": {
    "contractVersion": "1.0",
    "menuVersion": "menu-simulated-v2",
    "catalogHash": "sha256:40f2bd13ef5b91317e4cfcbbd868c82e208cb1347773a60e238bfea5c6cfba76",
    "canteen": {
      "canteenId": "canteen-sim",
      "name": "模拟食堂（非真实菜单）"
    },
    "windows": [
      {
        "windowId": "w-main",
        "name": "模拟主窗口",
        "mealWindows": [
          "breakfast",
          "lunch",
          "dinner"
        ]
      }
    ],
    "dishes": [
      {
        "dishId": "dish-rice",
        "name": "米饭",
        "kind": "single",
        "category": "staple",
        "riceDish": true,
        "riceIncluded": false,
        "nutrition": {
          "energyKcal": 232,
          "proteinDg": 44,
          "fatDg": 6,
          "carbDg": 516
        },
        "nutritionBasis": {
          "source": "simulated-reference",
          "portionAssumption": "模拟 200g 熟米饭",
          "estimated": true,
          "note": "SIMULATED"
        }
      },
      {
        "dishId": "dish-mantou",
        "name": "馒头",
        "kind": "single",
        "category": "staple",
        "riceDish": false,
        "riceIncluded": false,
        "nutrition": {
          "energyKcal": 220,
          "proteinDg": 70,
          "fatDg": 10,
          "carbDg": 470
        },
        "nutritionBasis": {
          "source": "simulated-reference",
          "portionAssumption": "模拟 100g 馒头",
          "estimated": true,
          "note": "SIMULATED"
        }
      },
      {
        "dishId": "dish-chicken",
        "name": "清蒸鸡胸",
        "kind": "single",
        "category": "protein",
        "riceDish": false,
        "riceIncluded": false,
        "nutrition": {
          "energyKcal": 165,
          "proteinDg": 310,
          "fatDg": 36,
          "carbDg": 0
        },
        "nutritionBasis": {
          "source": "simulated-reference",
          "portionAssumption": "模拟 100g 熟鸡胸",
          "estimated": true,
          "note": "SIMULATED"
        }
      },
      {
        "dishId": "dish-greens",
        "name": "清炒青菜",
        "kind": "single",
        "category": "vegetable",
        "riceDish": false,
        "riceIncluded": false,
        "nutrition": {
          "energyKcal": 80,
          "proteinDg": 20,
          "fatDg": 50,
          "carbDg": 60
        },
        "nutritionBasis": {
          "source": "simulated-reference",
          "portionAssumption": "模拟 150g 炒青菜",
          "estimated": true,
          "note": "SIMULATED"
        }
      }
    ],
    "offers": [
      {
        "offerId": "offer-rice-full",
        "dishId": "dish-rice",
        "windowId": "w-main",
        "mealWindows": [
          "breakfast",
          "lunch",
          "dinner"
        ],
        "portionCode": "full",
        "portionRatioNum": 1,
        "portionRatioDen": 1,
        "priceCents": 100,
        "priceBasis": "unitPrice"
      },
      {
        "offerId": "offer-rice-half",
        "dishId": "dish-rice",
        "windowId": "w-main",
        "mealWindows": [
          "breakfast",
          "lunch",
          "dinner"
        ],
        "portionCode": "half",
        "portionRatioNum": 1,
        "portionRatioDen": 2,
        "priceCents": 100,
        "priceBasis": "unitPrice"
      },
      {
        "offerId": "offer-mantou",
        "dishId": "dish-mantou",
        "windowId": "w-main",
        "mealWindows": [
          "breakfast"
        ],
        "portionCode": "full",
        "portionRatioNum": 1,
        "portionRatioDen": 1,
        "priceCents": 100,
        "priceBasis": "unitPrice"
      },
      {
        "offerId": "offer-chicken",
        "dishId": "dish-chicken",
        "windowId": "w-main",
        "mealWindows": [
          "lunch",
          "dinner"
        ],
        "portionCode": "full",
        "portionRatioNum": 1,
        "portionRatioDen": 1,
        "priceCents": 800,
        "priceBasis": "unitPrice"
      },
      {
        "offerId": "offer-greens",
        "dishId": "dish-greens",
        "windowId": "w-main",
        "mealWindows": [
          "lunch",
          "dinner"
        ],
        "portionCode": "full",
        "portionRatioNum": 1,
        "portionRatioDen": 1,
        "priceCents": 400,
        "priceBasis": "unitPrice"
      }
    ],
    "comboRules": []
  },
  "nutritionConfig": {
    "version": "nutrition-v1.2-candidate",
    "hash": "sha256:c93d2d91b13e54466e89d7d41ec50b1d93b6566cdee699af0cb81154a72dd288",
    "formula": "mifflin-st-jeor",
    "parameters": {
      "fatLossDeficitPermille": 100,
      "fatLossDeficitCapKcal": 300,
      "activityFactorPermille": {
        "sedentary": 1200,
        "light": 1375,
        "moderate": 1550,
        "active": 1725,
        "veryActive": 1900
      },
      "proteinMgPerKgNormal": 1200,
      "proteinMgPerKgTrainingPreference": 1500,
      "fatEnergyPermille": 270,
      "mealSharePermille": {
        "breakfast": 300,
        "lunch": 400,
        "dinner": 300
      }
    },
    "population": {
      "ageMinYears": 18,
      "ageMaxYears": 78,
      "pregnancyOrLactationPolicy": "disableAutoTargetsAndAutoPlanning",
      "medicalDietPolicy": "disableAutoTargetsAndAutoPlanning"
    },
    "macroThresholds": {
      "adult19To78": {
        "proteinBp": [
          1000,
          3500
        ],
        "fatBp": [
          2000,
          3500
        ],
        "carbBp": [
          4500,
          6500
        ],
        "carbFloorGPerDay": 130
      },
      "age18": {
        "proteinBp": [
          1000,
          3000
        ],
        "fatBp": [
          2500,
          3500
        ],
        "carbBp": [
          4500,
          6500
        ],
        "carbFloorGPerDay": null
      }
    },
    "energyFloor": {
      "maleKcalPerDay": 1500,
      "femaleKcalPerDay": 1200
    },
    "manualTargetRules": {
      "sourceTypes": [
        "professional",
        "userEntered"
      ],
      "tolerance": "max(20kcal,2%)",
      "derivedFieldsAllowed": true
    },
    "plannerSorting": {
      "nutritionDeviationWeightsPermille": {
        "energy": 250,
        "protein": 250,
        "fat": 250,
        "carb": 250
      },
      "nutritionTierWidthBp": 1000
    }
  },
  "plannerConfig": {
    "algorithm": "greedy",
    "strategies": [
      "primary",
      "economy",
      "taste"
    ],
    "budgetCents": 3000,
    "maxItemsPerMeal": 99,
    "limits": {
      "maxMealCandidatesPerMeal": 64,
      "maxDpStates": 20000,
      "maxSearchNodes": 200000,
      "wallClockMs": null
    }
  },
  "planningMeals": [
    "breakfast",
    "lunch",
    "dinner"
  ],
  "state": {
    "soldOut": [],
    "windowLocks": [],
    "itemLocks": [],
    "endedMeals": [],
    "activeLogs": []
  }
},
  },
  resourceLimited: {
    key: 'resourceLimited',
    name: '资源受限 (ResourceLimited)',
    description: '设置合法限额 limits.maxSearchNodes=3，搜索预算真实耗尽，返回 ResourceLimited',
    file: "plan-request-resource-limited.json",
    sha256: "B65794E90FD3B3B964F487A56ACA9B5E68F7CF84728B4F9FB41A54BDECF9B5D1",
    request: {
  "contractVersion": "1.0",
  "requestId": "req-v2-resource-limited",
  "businessDate": "2026-10-20",
  "tzOffsetMinutes": 480,
  "_note": "SIMULATED fixture for T02 v2 targeted fixes（T06a 已适配冻结契约四字段 limits）。Not real menu or nutrition acceptance. Scenario: a legal but tiny plannerConfig.limits.maxSearchNodes=3 exhausts the candidate-evaluation budget, so the core must report ResourceLimited (search limit reached) and must NOT claim the problem has no solution.",
  "profile": {
    "contractVersion": "1.0",
    "profileId": "p-v2-male",
    "revision": 1,
    "sex": "male",
    "ageYears": 20,
    "heightMm": 1750,
    "weightGrams": 70000,
    "bodyFatPermille": null,
    "activityLevel": "moderate",
    "goal": {
      "type": "fatLoss",
      "manualTargets": null
    },
    "trainingPreference": false,
    "dietaryFlags": {
      "pregnancyOrLactation": false,
      "medicalDietManagement": false
    },
    "tastes": []
  },
  "catalog": {
    "contractVersion": "1.0",
    "menuVersion": "menu-simulated-v2",
    "catalogHash": "sha256:40f2bd13ef5b91317e4cfcbbd868c82e208cb1347773a60e238bfea5c6cfba76",
    "canteen": {
      "canteenId": "canteen-sim",
      "name": "模拟食堂（非真实菜单）"
    },
    "windows": [
      {
        "windowId": "w-main",
        "name": "模拟主窗口",
        "mealWindows": [
          "breakfast",
          "lunch",
          "dinner"
        ]
      }
    ],
    "dishes": [
      {
        "dishId": "dish-rice",
        "name": "米饭",
        "kind": "single",
        "category": "staple",
        "riceDish": true,
        "riceIncluded": false,
        "nutrition": {
          "energyKcal": 232,
          "proteinDg": 44,
          "fatDg": 6,
          "carbDg": 516
        },
        "nutritionBasis": {
          "source": "simulated-reference",
          "portionAssumption": "模拟 200g 熟米饭",
          "estimated": true,
          "note": "SIMULATED"
        }
      },
      {
        "dishId": "dish-mantou",
        "name": "馒头",
        "kind": "single",
        "category": "staple",
        "riceDish": false,
        "riceIncluded": false,
        "nutrition": {
          "energyKcal": 220,
          "proteinDg": 70,
          "fatDg": 10,
          "carbDg": 470
        },
        "nutritionBasis": {
          "source": "simulated-reference",
          "portionAssumption": "模拟 100g 馒头",
          "estimated": true,
          "note": "SIMULATED"
        }
      },
      {
        "dishId": "dish-chicken",
        "name": "清蒸鸡胸",
        "kind": "single",
        "category": "protein",
        "riceDish": false,
        "riceIncluded": false,
        "nutrition": {
          "energyKcal": 165,
          "proteinDg": 310,
          "fatDg": 36,
          "carbDg": 0
        },
        "nutritionBasis": {
          "source": "simulated-reference",
          "portionAssumption": "模拟 100g 熟鸡胸",
          "estimated": true,
          "note": "SIMULATED"
        }
      },
      {
        "dishId": "dish-greens",
        "name": "清炒青菜",
        "kind": "single",
        "category": "vegetable",
        "riceDish": false,
        "riceIncluded": false,
        "nutrition": {
          "energyKcal": 80,
          "proteinDg": 20,
          "fatDg": 50,
          "carbDg": 60
        },
        "nutritionBasis": {
          "source": "simulated-reference",
          "portionAssumption": "模拟 150g 炒青菜",
          "estimated": true,
          "note": "SIMULATED"
        }
      }
    ],
    "offers": [
      {
        "offerId": "offer-rice-full",
        "dishId": "dish-rice",
        "windowId": "w-main",
        "mealWindows": [
          "breakfast",
          "lunch",
          "dinner"
        ],
        "portionCode": "full",
        "portionRatioNum": 1,
        "portionRatioDen": 1,
        "priceCents": 100,
        "priceBasis": "unitPrice"
      },
      {
        "offerId": "offer-rice-half",
        "dishId": "dish-rice",
        "windowId": "w-main",
        "mealWindows": [
          "breakfast",
          "lunch",
          "dinner"
        ],
        "portionCode": "half",
        "portionRatioNum": 1,
        "portionRatioDen": 2,
        "priceCents": 100,
        "priceBasis": "unitPrice"
      },
      {
        "offerId": "offer-mantou",
        "dishId": "dish-mantou",
        "windowId": "w-main",
        "mealWindows": [
          "breakfast"
        ],
        "portionCode": "full",
        "portionRatioNum": 1,
        "portionRatioDen": 1,
        "priceCents": 100,
        "priceBasis": "unitPrice"
      },
      {
        "offerId": "offer-chicken",
        "dishId": "dish-chicken",
        "windowId": "w-main",
        "mealWindows": [
          "lunch",
          "dinner"
        ],
        "portionCode": "full",
        "portionRatioNum": 1,
        "portionRatioDen": 1,
        "priceCents": 800,
        "priceBasis": "unitPrice"
      },
      {
        "offerId": "offer-greens",
        "dishId": "dish-greens",
        "windowId": "w-main",
        "mealWindows": [
          "lunch",
          "dinner"
        ],
        "portionCode": "full",
        "portionRatioNum": 1,
        "portionRatioDen": 1,
        "priceCents": 400,
        "priceBasis": "unitPrice"
      }
    ],
    "comboRules": []
  },
  "nutritionConfig": {
    "version": "nutrition-v1.2-candidate",
    "hash": "sha256:c93d2d91b13e54466e89d7d41ec50b1d93b6566cdee699af0cb81154a72dd288",
    "formula": "mifflin-st-jeor",
    "parameters": {
      "fatLossDeficitPermille": 100,
      "fatLossDeficitCapKcal": 300,
      "activityFactorPermille": {
        "sedentary": 1200,
        "light": 1375,
        "moderate": 1550,
        "active": 1725,
        "veryActive": 1900
      },
      "proteinMgPerKgNormal": 1200,
      "proteinMgPerKgTrainingPreference": 1500,
      "fatEnergyPermille": 270,
      "mealSharePermille": {
        "breakfast": 300,
        "lunch": 400,
        "dinner": 300
      }
    },
    "population": {
      "ageMinYears": 18,
      "ageMaxYears": 78,
      "pregnancyOrLactationPolicy": "disableAutoTargetsAndAutoPlanning",
      "medicalDietPolicy": "disableAutoTargetsAndAutoPlanning"
    },
    "macroThresholds": {
      "adult19To78": {
        "proteinBp": [
          1000,
          3500
        ],
        "fatBp": [
          2000,
          3500
        ],
        "carbBp": [
          4500,
          6500
        ],
        "carbFloorGPerDay": 130
      },
      "age18": {
        "proteinBp": [
          1000,
          3000
        ],
        "fatBp": [
          2500,
          3500
        ],
        "carbBp": [
          4500,
          6500
        ],
        "carbFloorGPerDay": null
      }
    },
    "energyFloor": {
      "maleKcalPerDay": 1500,
      "femaleKcalPerDay": 1200
    },
    "manualTargetRules": {
      "sourceTypes": [
        "professional",
        "userEntered"
      ],
      "tolerance": "max(20kcal,2%)",
      "derivedFieldsAllowed": true
    },
    "plannerSorting": {
      "nutritionDeviationWeightsPermille": {
        "energy": 250,
        "protein": 250,
        "fat": 250,
        "carb": 250
      },
      "nutritionTierWidthBp": 1000
    }
  },
  "plannerConfig": {
    "algorithm": "greedy",
    "strategies": [
      "primary",
      "economy",
      "taste"
    ],
    "budgetCents": 3000,
    "maxItemsPerMeal": 3,
    "limits": {
      "maxMealCandidatesPerMeal": 64,
      "maxDpStates": 20000,
      "maxSearchNodes": 3,
      "wallClockMs": null
    }
  },
  "planningMeals": [
    "breakfast",
    "lunch",
    "dinner"
  ],
  "state": {
    "soldOut": [],
    "windowLocks": [],
    "itemLocks": [],
    "endedMeals": [],
    "activeLogs": []
  }
},
  },
};

// 默认模拟请求（成功用例）
export const PLAN_REQUEST_SIMULATED: any = FIXTURE_CASES.success.request;
