// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { Bike, Building, Film, Github, Ham, Home, Pizza } from "lucide-react";
import { Bot } from "lucide-react";

import { BentoCard } from "@/components/DeerFlow/components/magicui/bento-grid";

import { SectionHeader } from "../components/section-header";

const caseStudies = [
  {
    id: "eiffel-tower-vs-tallest-building",
    icon: Building,
    title: "How tall is Eiffel Tower compared to tallest building?",
    description:
      "The research compares the heights and global significance of the Eiffel Tower and Burj Khalifa, and uses Python code to calculate the multiples.",
  },
  {
    id: "github-top-trending-repo",
    icon: Github,
    title: "What are the top trending repositories on GitHub?",
    description:
      "The research utilized MCP services to identify the most popular GitHub repositories and documented them in detail using search engines.",
  },
  {
    id: "nanjing-traditional-dishes",
    icon: Ham,
    title: "Write an article about Nanjing's traditional dishes",
    description:
      "The study vividly showcases Nanjing's famous dishes through rich content and imagery, uncovering their hidden histories and cultural significance.",
  },
  {
    id: "rental-apartment-decoration",
    icon: Home,
    title: "How to decorate a small rental apartment?",
    description:
      "The study provides readers with practical and straightforward methods for decorating apartments, accompanied by inspiring images.",
  },
  {
    id: "review-of-the-professional",
    icon: Film,
    title: "Introduce the movie 'Léon: The Professional'",
    description:
      "The research provides a comprehensive introduction to the movie 'Léon: The Professional', including its plot, characters, and themes.",
  },
  {
    id: "china-food-delivery",
    icon: Bike,
    title: "How do you view the takeaway war in China? (in Chinese)",
    description:
      "The research analyzes the intensifying competition between JD and Meituan, highlighting their strategies, technological innovations, and challenges.",
  },
  {
    id: "ultra-processed-foods",
    icon: Pizza,
    title: "Are ultra-processed foods linked to health?",
    description:
      "The research examines the health risks of rising ultra-processed food consumption, urging more research on long-term effects and individual differences.",
  },
  {
    id: "ai-twin-insurance",
    icon: Bot,
    title: 'Write an article on "Would you insure your AI twin?"',
    description:
      "The research explores the concept of insuring AI twins, highlighting their benefits, risks, ethical considerations, and the evolving regulatory.",
  },
];

export function CaseStudySection() {
  return (
    <section className="relative container hidden flex-col items-center justify-center md:flex">
      <SectionHeader
        anchor="case-studies"
        title="Case Studies"
        description="See DeerFlow in action through replays."
      />
      <div className="grid w-3/4 grid-cols-1 gap-2 sm:w-full sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {caseStudies.map((caseStudy) => (
          <div key={caseStudy.title} className="w-full p-2">
            <BentoCard
              {...{
                Icon: caseStudy.icon,
                name: caseStudy.title,
                description: caseStudy.description,
                href: `/chat?replay=${caseStudy.id}`,
                cta: "Click to watch replay",
                className: "w-full h-full",
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
