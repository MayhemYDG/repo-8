import { Wallet } from "ethers";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";

import { ContractManager,
         Nodes,
         Pricing,
         SchainsInternal,
         ValidatorService,
         Schains,
         ConstantsHolder,
         NodeRotation } from "../typechain-types";

import { privateKeys } from "./tools/private-keys";

import { deployContractManager } from "./tools/deploy/contractManager";
import { deployNodes } from "./tools/deploy/nodes";
import { deployPricing } from "./tools/deploy/pricing";
import { deploySchainsInternal } from "./tools/deploy/schainsInternal";
import { skipTime, currentTime } from "./tools/time";
import { deployValidatorService } from "./tools/deploy/delegation/validatorService";
import { deploySchains } from "./tools/deploy/schains";
import { deployConstantsHolder } from "./tools/deploy/constantsHolder";
import { deployNodeRotation } from "./tools/deploy/nodeRotation";
import { deploySkaleManagerMock } from "./tools/deploy/test/skaleManagerMock";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { getPublicKey, getValidatorIdSignature } from "./tools/signatures";
import { stringKeccak256 } from "./tools/hashes";
import { fastBeforeEach } from "./tools/mocha";

chai.should();
chai.use(chaiAsPromised);

describe("Pricing", () => {
    let owner: SignerWithAddress;
    let holder: SignerWithAddress;
    let validator: SignerWithAddress;
    let nodeAddress: Wallet;

    let contractManager: ContractManager;
    let pricing: Pricing;
    let schainsInternal: SchainsInternal;
    let schains: Schains;
    let nodes: Nodes;
    let validatorService: ValidatorService;
    let constants: ConstantsHolder;
    let nodeRotation: NodeRotation;

    fastBeforeEach(async () => {
        [owner, holder, validator] = await ethers.getSigners();

        nodeAddress = new Wallet(String(privateKeys[3])).connect(ethers.provider);

        await owner.sendTransaction({to: nodeAddress.address, value: ethers.utils.parseEther("10000")});

        contractManager = await deployContractManager();

        nodes = await deployNodes(contractManager);
        schainsInternal = await deploySchainsInternal(contractManager);
        schains = await deploySchains(contractManager);
        pricing = await deployPricing(contractManager);
        validatorService = await deployValidatorService(contractManager);
        constants = await deployConstantsHolder(contractManager);
        nodeRotation = await deployNodeRotation(contractManager);

        const skaleManagerMock = await deploySkaleManagerMock(contractManager);
        await contractManager.setContractsAddress("SkaleManager", skaleManagerMock.address);

        await validatorService.connect(validator).registerValidator("Validator", "D2", 0, 0);
        const validatorIndex = await validatorService.getValidatorId(validator.address);
        const signature1 = await getValidatorIdSignature(validatorIndex, nodeAddress);
        await validatorService.connect(validator).linkNodeAddress(nodeAddress.address, signature1);
        const NODE_MANAGER_ROLE = await nodes.NODE_MANAGER_ROLE();
        await nodes.grantRole(NODE_MANAGER_ROLE, owner.address);
    });

    describe("on initialized contracts", async () => {
        fastBeforeEach(async () => {
            await schainsInternal.initializeSchain("BobSchain", holder.address, ethers.constants.AddressZero, 10, 2);
            await schainsInternal.initializeSchain("DavidSchain", holder.address, ethers.constants.AddressZero, 10, 4);
            await schainsInternal.initializeSchain("JacobSchain", holder.address, ethers.constants.AddressZero, 10, 8);
            await nodes.createNode(
                nodeAddress.address,
                {
                    port: 8545,
                    nonce: 0,
                    ip: "0x7f000001",
                    publicIp: "0x7f000001",
                    publicKey: getPublicKey(nodeAddress),
                    name: "elvis1",
                    domainName: "some.domain.name"
                });

            await nodes.createNode(
                nodeAddress.address,
                {
                    port: 8545,
                    nonce: 0,
                    ip: "0x7f000003",
                    publicIp: "0x7f000003",
                    publicKey: getPublicKey(nodeAddress),
                    name: "elvis2",
                    domainName: "some.domain.name"
                });

            await nodes.createNode(
                nodeAddress.address,
                {
                    port: 8545,
                    nonce: 0,
                    ip: "0x7f000005",
                    publicIp: "0x7f000005",
                    publicKey: getPublicKey(nodeAddress),
                    name: "elvis3",
                    domainName: "some.domain.name"
                });

            await nodes.createNode(
                nodeAddress.address,
                {
                    port: 8545,
                    nonce: 0,
                    ip: "0x7f000007",
                    publicIp: "0x7f000007",
                    publicKey: getPublicKey(nodeAddress),
                    name: "elvis4",
                    domainName: "some.domain.name"
                });

        });

        it("should increase number of schains", async () => {
            const numberOfSchains = await schainsInternal.numberOfSchains();
            numberOfSchains.should.be.equal(3);
        });

        it("should increase number of nodes", async () => {
            const numberOfNodes = await nodes.getNumberOfNodes();
            numberOfNodes.should.be.equal(4);
        });

        describe("on existing nodes and schains", async () => {
            const bobSchainHash = stringKeccak256("BobSchain");
            const davidSchainHash = stringKeccak256("DavidSchain");
            const jacobSchainHash = stringKeccak256("JacobSchain");

            fastBeforeEach(async () => {

                await schainsInternal.createGroupForSchain(bobSchainHash, 1, 32);
                await schainsInternal.createGroupForSchain(davidSchainHash, 1, 32);
                await schainsInternal.createGroupForSchain(jacobSchainHash, 2, 128);

            });

            async function getLoadCoefficient() {
                const numberOfNodes = (await nodes.getNumberOfNodes()).toNumber();
                let sumNode = 0;
                for (let i = 0; i < numberOfNodes; i++) {
                    if (await nodes.isNodeActive(i)) {
                        const getSchainHashesForNode = await schainsInternal.getSchainHashesForNode(i);
                        for (const schain of getSchainHashesForNode) {
                            const partOfNode = await schainsInternal.getSchainsPartOfNode(schain);
                            const isNodeLeft = await nodes.isNodeLeft(i);
                            if (partOfNode !== 0  && !isNodeLeft) {
                                sumNode += partOfNode;
                            }
                        }
                    }
                }
                return sumNode / (128 * (await nodes.getNumberOnlineNodes()).toNumber());
            }

            it("should check load percentage of network", async () => {
                const newLoadPercentage = Math.floor(await getLoadCoefficient() * 100);
                const loadPercentage = await pricing.getTotalLoadPercentage();
                loadPercentage.should.be.equal(newLoadPercentage);
            });

            it("should check total number of nodes", async () => {
                await pricing.initNodes();
                const totalNodes = await pricing.totalNodes();
                totalNodes.should.be.equal(4);
            });

            it("should not change price when no any new nodes have been added", async () => {
                await pricing.initNodes();
                await skipTime(61);
                await pricing.adjustPrice()
                    .should.be.eventually.rejectedWith("No changes to node supply");
            });

            it("should not change price when the price is updated more often than necessary", async () => {
                await pricing.initNodes();
                await pricing.adjustPrice()
                    .should.be.eventually.rejectedWith("It's not a time to update a price");
            });

            describe("change price when changing the number of nodes", async () => {
                let oldPrice: number;
                let lastUpdated: number;

                fastBeforeEach(async () => {
                    await pricing.initNodes();
                    oldPrice = (await pricing.price()).toNumber();
                    lastUpdated = (await pricing.lastUpdated()).toNumber()
                });

                async function getPrice(secondSincePreviousUpdate: number) {
                    const MIN_PRICE = (await constants.MIN_PRICE()).toNumber();
                    const ADJUSTMENT_SPEED = (await constants.ADJUSTMENT_SPEED()).toNumber();
                    const OPTIMAL_LOAD_PERCENTAGE = (await constants.OPTIMAL_LOAD_PERCENTAGE()).toNumber();
                    const COOLDOWN_TIME = (await constants.COOLDOWN_TIME()).toNumber();

                    const priceChangeSpeed = ADJUSTMENT_SPEED * (oldPrice / MIN_PRICE) * (await getLoadCoefficient() * 100 - OPTIMAL_LOAD_PERCENTAGE);
                    let price = oldPrice + priceChangeSpeed * secondSincePreviousUpdate / COOLDOWN_TIME;
                    if (price < MIN_PRICE) {
                        price = MIN_PRICE;
                    }
                    return Math.floor(price);
                }

                it("should change price when new active node has been added", async () => {
                    await nodes.createNode(
                        nodeAddress.address,
                        {
                            port: 8545,
                            nonce: 0,
                            ip: "0x7f000010",
                            publicIp: "0x7f000011",
                            publicKey: getPublicKey(nodeAddress),
                            name: "vadim",
                            domainName: "some.domain.name"
                        });
                    const MINUTES_PASSED = 2;
                    await skipTime(lastUpdated + MINUTES_PASSED * 60 - await currentTime());

                    await pricing.adjustPrice();
                    const receivedPrice = (await pricing.price()).toNumber();

                    const correctPrice = await getPrice((await pricing.lastUpdated()).toNumber() - lastUpdated);

                    receivedPrice.should.be.equal(correctPrice);
                    oldPrice.should.be.above(receivedPrice);
                });

                it("should change price when active node has been removed", async () => {
                    // search non full node to rotate
                    let nodeToExit = -1;
                    let numberOfSchains = 0;
                    for (let i = 0; i < (await nodes.getNumberOfNodes()).toNumber(); i++) {
                        if (await nodes.isNodeActive(i)) {
                            const getSchainHashesForNode = await schainsInternal.getSchainHashesForNode(i);
                            let totalPartOfNode = 0;
                            numberOfSchains = 0;
                            for (const schain of getSchainHashesForNode) {
                                const partOfNode = await schainsInternal.getSchainsPartOfNode(schain);
                                ++numberOfSchains;
                                totalPartOfNode += partOfNode;
                            }
                            if (totalPartOfNode < 100) {
                                nodeToExit = i;
                                break;
                            }
                        }
                    }

                    await nodes.initExit(nodeToExit);
                    for(let i = 0; i < numberOfSchains; ++i) {
                        await nodeRotation.exitFromSchain(nodeToExit);
                    }
                    await nodes.completeExit(nodeToExit);

                    const MINUTES_PASSED = 2;
                    await skipTime(lastUpdated + MINUTES_PASSED * 60 - await currentTime());

                    await pricing.adjustPrice();
                    const receivedPrice = (await pricing.price()).toNumber();

                    const correctPrice = await getPrice((await pricing.lastUpdated()).toNumber() - lastUpdated);

                    receivedPrice.should.be.equal(correctPrice);
                    oldPrice.should.be.below(receivedPrice);
                });

                it("should set price to min of too many minutes passed and price is less than min", async () => {
                    await nodes.createNode(
                        nodeAddress.address,
                        {
                            port: 8545,
                            nonce: 0,
                            ip: "0x7f000010",
                            publicIp: "0x7f000011",
                            publicKey: getPublicKey(nodeAddress),
                            name: "vadim",
                            domainName: "some.domain.name"
                        });

                    const MINUTES_PASSED = 30;
                    await skipTime(lastUpdated + MINUTES_PASSED * 60 - await currentTime());

                    await pricing.adjustPrice();
                    const receivedPrice = (await pricing.price()).toNumber();

                    const correctPrice = await getPrice((await pricing.lastUpdated()).toNumber() - lastUpdated);

                    receivedPrice.should.be.equal(correctPrice);
                    oldPrice.should.be.above(receivedPrice);
                });
            });
        });
    });
});
