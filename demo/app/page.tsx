"use client";

import Image from "next/image";

import ConnectWallet from "./components/ConnectWallet";
import { useAccount } from "wagmi";
import { Alchemy, Network } from "alchemy-sdk";
import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import RLP from "rlp";
import level from "level-mem";
import { BaseTrie as Trie } from "merkle-patricia-tree";
import { serializeTransaction, toHex } from "viem";
import { mainnet } from "viem/chains";
import { Button, Typography } from "@alembic/ui";
import { useWriteContract } from "wagmi";

export default function Home() {
  const [firstTransactionDate, setFirstTransactionDate] = useState("");
  const { isConnected, address } = useAccount();
  const { writeContract } = useWriteContract();

  const mainnetClient = usePublicClient({
    chainId: mainnet.id,
  });

  useEffect(() => {
    if (!mainnetClient) return;

    const getFirstTxDate = async () => {
      const config = {
        apiKey: "Kh0StYk_8YO-0GzqYzPRD3-T6L9v_Kk9",
        network: Network.ETH_MAINNET,
      };
      const alchemy = new Alchemy(config);

      /* @ts-ignore */
      const data = await alchemy.core.getAssetTransfers({
        fromBlock: "0x0",
        fromAddress: address,
        category: ["external", "internal", "erc20", "erc721", "erc1155"],
        excludeZeroValue: false,
        maxCount: "0x1",
      });

      if (data.transfers.length == 0) return;

      /* @ts-ignore */
      const block = await mainnetClient.getBlock({
        includeTransactions: true,
        blockNumber: BigInt(data.transfers[0].blockNum),
      });

      const db = level();
      const trie = new Trie(db);

      const firstTransaction = block.transactions.find(
        (v: any) => v.hash === data.transfers[0].hash
      );

      for (const transaction of block.transactions) {
        const key = toHex(RLP.encode(transaction.transactionIndex));
        // https://github.com/wevm/viem/issues/1867
        if (!transaction.data) transaction.data = transaction.input;
        const value = serializeTransaction(transaction, transaction);

        await trie.put(
          Buffer.from(key.slice(2), "hex"),
          Buffer.from(value.slice(2), "hex")
        );
      }

      console.log("firstTransaction:", firstTransaction);

      if (!firstTransaction.data)
        firstTransaction.data = firstTransaction.input;

      const sKey = toHex(RLP.encode(firstTransaction.transactionIndex));

      const proof = await Trie.createProof(
        trie,
        Buffer.from(sKey.slice(2), "hex")
      );

      const value = await Trie.verifyProof(
        trie.root,
        Buffer.from(sKey.slice(2), "hex"),
        proof
      );

      const hexValue = [...new Uint8Array(value)]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");

      console.log("Raw Transaction Hex:", hexValue);

      let date = new Date(Number(block.timestamp) * 1000);
      setFirstTransactionDate("First tx: " + date.toDateString());
    };

    isConnected ? getFirstTxDate() : setFirstTransactionDate("");
  }, [isConnected, mainnetClient]); // Only re-run the effect if count changes

  const claimNft = () => {
    /* @ts-ignore */
    writeContract({
      abi,
      address: "0x6b175474e89094c44da98b954eedeac495271d0f",
      functionName: "claim",
      args: [],
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <div className="flex justify-between">
          <Typography
            content={"Ethereum Optimistic History Prover"}
            variant="h2"
          />
        </div>

        <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-gradient-to-t from-white via-white dark:from-black dark:via-black lg:static lg:h-auto lg:w-auto lg:bg-none">
          <a
            className="pointer-events-none flex place-items-center gap-2 p-8 lg:pointer-events-auto lg:p-0"
            href="https://github.com/cometh-hq/optimistic-eth-history-prover"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src={"/social/github.svg"}
              alt={"Github"}
              width={50}
              height={50}
            />
          </a>
        </div>
      </div>
      <div className="relative flex place-items-center before:absolute before:h-[300px] before:w-full sm:before:w-[480px] before:-translate-x-1/2 before:rounded-full before:bg-gradient-radial before:from-white before:to-transparent before:blur-2xl before:content-[''] after:absolute after:-z-20 after:h-[180px] after:w-full sm:after:w-[240px] after:translate-x-1/3 after:bg-gradient-conic after:from-sky-200 after:via-blue-200 after:blur-2xl after:content-[''] before:dark:bg-gradient-to-br before:dark:from-transparent before:dark:to-blue-700 before:dark:opacity-10 after:dark:from-sky-900 after:dark:via-[#0141ff] after:dark:opacity-40 before:lg:h-[360px] z-[-1]">
        <Image
          className="relative dark:drop-shadow-[0_0_0.3rem_#ffffff70] dark:invert"
          src="/logo.png"
          alt="logo"
          width={180}
          height={37}
          priority
        />
        <div>
          <div className="mb-4">
            <Typography content={"Current Owner:"} variant="h6" />
            <Typography content={"Ethereum OG"} variant="p" className="mb-2" />
          </div>

          <div>
            <Typography content={"First tx date:"} variant="h6" />
            <Typography
              content={"February 11, 2016"}
              variant="p"
              className="mb-2"
            />
          </div>
        </div>
      </div>
      <div>
        <h2 className="mb-3 mt-3 text-xl">{firstTransactionDate}</h2>
        <ConnectWallet />

        {isConnected && (
          <div className="relative flex items-center gap-x-6 rounded-lg p-4">
            <Button
              onClick={() => {
                claimNft();
              }}
              isPrimary={true}
              isGlass={false}
              isSecondary={false}
            >
              <Typography content="Claim OG NFT" />
            </Button>
          </div>
        )}
      </div>{" "}
      <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-4 lg:text-left">
        <h1>Ranking</h1>
      </div>
    </main>
  );
}