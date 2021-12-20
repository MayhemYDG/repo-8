import { ContractManager, ReentrancyTester } from "../../../../typechain";
import { deployWithConstructorFunctionFactory } from "../factory";
import { deploySkaleToken } from "../skaleToken";

const deployReentrancyTester: (contractManager: ContractManager) => Promise<ReentrancyTester>
    = deployWithConstructorFunctionFactory("ReentrancyTester",
                            async (contractManager: ContractManager) => {
                                await deploySkaleToken(contractManager);
                            });

export { deployReentrancyTester };
