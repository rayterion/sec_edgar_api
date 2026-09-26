export interface FieldMapping {
    tags: readonly string[];
    additive: boolean;
}
export declare const incomeMappings: Record<string, FieldMapping>;
export declare const balanceMappings: Record<string, FieldMapping>;
export declare const cashFlowMappings: Record<string, FieldMapping>;
export declare const industryMappings: {
    readonly investmentCompany: {
        readonly grossInvestmentIncome: {
            readonly tags: readonly ["us-gaap:GrossInvestmentIncomeOperating"];
            readonly additive: true;
        };
        readonly netInvestmentIncome: {
            readonly tags: readonly ["us-gaap:NetInvestmentIncome"];
            readonly additive: true;
        };
    };
    readonly insurance: {
        readonly premiumsEarned: {
            readonly tags: readonly ["us-gaap:PremiumsEarnedNet"];
            readonly additive: true;
        };
        readonly netInvestmentIncome: {
            readonly tags: readonly ["us-gaap:NetInvestmentIncome"];
            readonly additive: true;
        };
    };
    readonly reit: {
        readonly leaseIncome: {
            readonly tags: readonly ["us-gaap:LeaseIncome"];
            readonly additive: true;
        };
    };
    readonly bank: {
        readonly netInterestIncome: {
            readonly tags: readonly ["us-gaap:InterestIncomeExpenseNet"];
            readonly additive: true;
        };
        readonly noninterestIncome: {
            readonly tags: readonly ["us-gaap:NoninterestIncome"];
            readonly additive: true;
        };
    };
};
export type IndustryProfile = keyof typeof industryMappings;
export declare const industryBalanceMappings: {
    readonly investmentCompany: {
        readonly investmentsAtFairValue: {
            readonly tags: readonly ["us-gaap:InvestmentOwnedAtFairValue"];
            readonly additive: false;
        };
    };
    readonly insurance: {
        readonly claimsReserve: {
            readonly tags: readonly ["us-gaap:LiabilityForClaimsAndClaimsAdjustmentExpense"];
            readonly additive: false;
        };
    };
    readonly reit: {
        readonly realEstateInvestmentPropertyNet: {
            readonly tags: readonly ["us-gaap:RealEstateInvestmentPropertyNet"];
            readonly additive: false;
        };
    };
    readonly bank: {
        readonly deposits: {
            readonly tags: readonly ["us-gaap:Deposits"];
            readonly additive: false;
        };
    };
};
