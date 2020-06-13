import { LootCreator } from './loot-creator.js';
import { LootBuilder } from './loot-builder.js'
import { LootChatCard } from './loot-chat-card.js';
import { StoryBuilder } from './story/story-builder.js';
import { StoryChatCard } from './story/story-chat-card.js';

export class BetterTables {
    async generateLoot(tableEntity) {
        const lootBuilder = new LootBuilder(tableEntity);
        const generatedLoot = await lootBuilder.generateLoot();
        const lootCreator = new LootCreator(generatedLoot);
        await lootCreator.createActor();
        await lootCreator.addCurrenciesToActor();
        await lootCreator.addItemsToActor();
    }

    async generateChatLoot(tableEntity) {
        const lootBuilder = new LootBuilder(tableEntity);
        const generatedLoot = await lootBuilder.generateLoot();
        const lootChatCard = new LootChatCard(generatedLoot);
        await lootChatCard.createChatCard(tableEntity);
    }

    async generateChatStory(tableEntity) {
        const storyBuilder = new StoryBuilder(tableEntity);
        await storyBuilder.drawStory();
        const storyHtml = storyBuilder.generatedStory();
        const storyGMHtml = storyBuilder.generatedStoryGM();
        const storyChat = new StoryChatCard(tableEntity);
        storyChat.createChatCard(storyHtml);
        storyChat.createChatCard(storyGMHtml, { gmOnly: true });
    }

    async betterTableRoll(tableEntity) {
        console.log("Better roll clicked");
    }
}