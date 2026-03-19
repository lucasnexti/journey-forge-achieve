import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PendingSurvey {
  id: string;
  type: "nps" | "csat";
  question: string;
  title: string;
  trigger_type: string;
}

/**
 * Checks for pending surveys the user hasn't answered yet.
 * Triggers on: track_completion (pass trackId), periodic (on dashboard), login_milestone.
 */
export const useSurveyTrigger = (triggerType?: string, contextId?: string) => {
  const { user } = useAuth();
  const [pendingSurvey, setPendingSurvey] = useState<PendingSurvey | null>(null);
  const [showSurvey, setShowSurvey] = useState(false);

  const checkSurveys = useCallback(async () => {
    if (!user) return;

    // Get active surveys for this trigger type
    let query = supabase
      .from("surveys")
      .select("id, type, question, title, trigger_type")
      .eq("is_active", true);

    if (triggerType) {
      query = query.eq("trigger_type", triggerType);
    }

    const { data: surveys } = await query;
    if (!surveys?.length) return;

    // Check which ones the user already answered
    const { data: responses } = await supabase
      .from("survey_responses")
      .select("survey_id")
      .eq("user_id", user.id);

    const answeredIds = new Set(responses?.map((r) => r.survey_id) || []);
    const unanswered = surveys.filter((s) => !answeredIds.has(s.id));

    if (unanswered.length > 0) {
      setPendingSurvey(unanswered[0] as PendingSurvey);
      // Small delay before showing
      setTimeout(() => setShowSurvey(true), 2000);
    }
  }, [user, triggerType]);

  useEffect(() => {
    checkSurveys();
  }, [checkSurveys]);

  const dismissSurvey = () => {
    setShowSurvey(false);
    setPendingSurvey(null);
  };

  return { pendingSurvey, showSurvey, dismissSurvey };
};
