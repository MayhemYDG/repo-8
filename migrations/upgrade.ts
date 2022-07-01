import { contracts } from "./deploy";
import hre, { ethers, upgrades } from "hardhat";
import chalk from "chalk";
import { ProxyAdmin, SkaleManager, SchainsInternal } from "../typechain-types";
import { upgrade, SkaleABIFile, getContractKeyInAbiFile, encodeTransaction, verify, getAbi } from "@skalenetwork/upgrade-tools"
import { getManifestAdmin } from "@openzeppelin/hardhat-upgrades/dist/admin";


async function getSkaleManager(abi: SkaleABIFile) {
    return ((await ethers.getContractFactory("SkaleManager")).attach(
        abi[getContractKeyInAbiFile("SkaleManager") + "_address"] as string
    )) as SkaleManager;
}

async function getSchainsInternal(abi: SkaleABIFile) {
    return ((await ethers.getContractFactory("SchainsInternal")).attach(
        abi[getContractKeyInAbiFile("SchainsInternal") + "_address"] as string
    )) as SchainsInternal;
}

export async function getDeployedVersion(abi: SkaleABIFile) {
    const skaleManager = await getSkaleManager(abi);
    return await skaleManager.version();
}

export async function setNewVersion(safeTransactions: string[], abi: SkaleABIFile, newVersion: string) {
    const skaleManager = await getSkaleManager(abi);
    safeTransactions.push(encodeTransaction(
        0,
        skaleManager.address,
        0,
        skaleManager.interface.encodeFunctionData("setVersion", [newVersion]),
    ));
}

function getContractsWithout(contractName: string | undefined): string[] {
    if (!contractName)
        return ["ContractManager"].concat(contracts);

    const index = contracts.indexOf(contractName);
    if (~index) {
        contracts.splice(index, 1);
    }
    return  ["ContractManager"].concat(contracts);
}

async function main() {
    await upgrade(
        "skale-manager",
        "1.9.0",
        getDeployedVersion,
        setNewVersion,
        ["SkaleManager", "SchainsInternal"],
        getContractsWithout("ConstantsHolder"), // Remove ConstantsHolder from contracts to do upgradeAndCall
        // async (safeTransactions, abi, contractManager) => {
        async () => {
            // deploy new contracts
        },
        async (safeTransactions, abi) => {
            const schainsInternal = await getSchainsInternal(abi);
            const numberOfSchains = (await schainsInternal.numberOfSchains()).toNumber();
            const schainLimitPerTransaction = 10;
            if (numberOfSchains > 0) {
                let limitOfSchains = schainLimitPerTransaction;
                if (numberOfSchains < schainLimitPerTransaction) {
                    limitOfSchains = numberOfSchains;
                }
                safeTransactions.push(encodeTransaction(
                    0,
                    schainsInternal.address,
                    0,
                    schainsInternal.interface.encodeFunctionData("initializeSchainAddresses", [
                        0,
                        limitOfSchains
                    ])
                ));
            }

            // ======================================================================================

            const proxyAdmin = await getManifestAdmin(hre) as ProxyAdmin;
            const constantsHolderName = "ConstantsHolder";
            const constantsHolderAddress = abi["constants_holder_address"] as string;
            const constantsHolderFactory = await ethers.getContractFactory(constantsHolderName);
            
            console.log(`Prepare upgrade of ${constantsHolderName}`);
            const newImplementationAddress = await upgrades.prepareUpgrade(
                constantsHolderAddress,
                constantsHolderFactory
            );
            await verify(constantsHolderName, newImplementationAddress, []);
    
            // Switch proxies to new implementations
            console.log(chalk.yellowBright(`Prepare transaction to upgradeAndCall ${constantsHolderName} at ${constantsHolderAddress} to ${newImplementationAddress}`));
            const encodedReinitialize = constantsHolderFactory.interface.encodeFunctionData("reinitialize", []);
            safeTransactions.push(encodeTransaction(
                0,
                proxyAdmin.address,
                0,
                proxyAdmin.interface.encodeFunctionData("upgradeAndCall", [constantsHolderAddress, newImplementationAddress, encodedReinitialize])
            ));
            abi[getContractKeyInAbiFile(constantsHolderName) + "_abi"] = getAbi(constantsHolderFactory.interface);
        },
        async (abi) => {
            const schainsInternal = await getSchainsInternal(abi);
            const numberOfSchains = (await schainsInternal.numberOfSchains()).toNumber();
            const schainLimitPerTransaction = 10;
            const nextSafeTransactions: string[][] = [];
            if (numberOfSchains > schainLimitPerTransaction) {
                console.log(chalk.redBright("---------------------------Attention---------------------------"));
                console.log(chalk.redBright(`Total schains amount is ${numberOfSchains}`));
                console.log(chalk.redBright("Initialization should be in DIFFERENT safe upgrade transactions"));
                for (let step = 1; step * schainLimitPerTransaction < numberOfSchains; step++) {
                    let limitOfSchains = step * schainLimitPerTransaction + schainLimitPerTransaction;
                    if (numberOfSchains < limitOfSchains) {
                        limitOfSchains = numberOfSchains;
                    }
                    nextSafeTransactions.push([encodeTransaction(
                        0,
                        schainsInternal.address,
                        0,
                        schainsInternal.interface.encodeFunctionData("initializeSchainAddresses", [
                            step * schainLimitPerTransaction,
                            limitOfSchains
                        ])
                    )]);
                }
            }
            return nextSafeTransactions;
        }
    );
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
