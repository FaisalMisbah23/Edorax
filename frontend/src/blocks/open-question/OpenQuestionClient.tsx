"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { apiFetch } from "@/lib/api-client";
import { playFeedback } from "@/lib/sound-feedback";
import { PersonalizedNote, PersonalizedPromptText } from "@/components/learn/earlier-answers";
import type { OpenQuestionBlockState } from "@/shared/api/blocks";
import {
  OpenQuestionClient as SharedOpenQuestionClient,
  type OpenQuestionRespondResult,
} from "@buildment/learning-ui/blocks/exercises/OpenQuestionClient";

type Props = Omit<ComponentProps<typeof SharedOpenQuestionClient>, "personalizedNote" | "promptNode"> & {
  personalized?: OpenQuestionBlockState["personalized"];
};

export function OpenQuestionClient({ personalized, ...props }: Props) {
  const router = useRouter();
  return (
    <SharedOpenQuestionClient
      {...props}
      personalizedNote={personalized ? <PersonalizedNote rewritten={personalized.rewritten} references={personalized.references} /> : undefined}
      promptNode={
        personalized?.rewritten ? (
          <PersonalizedPromptText prompt={props.config.prompt} references={personalized.references} />
        ) : undefined
      }
      onRespond={(payload) =>
        apiFetch<OpenQuestionRespondResult>(`/api/v1/blocks/${props.id}/respond`, {
          method: "POST",
          json: payload,
        })
      }
      onComplete={() => router.refresh()}
      onFeedback={playFeedback}
    />
  );
}
