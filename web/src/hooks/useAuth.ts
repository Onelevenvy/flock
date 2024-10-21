import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "react-query";

import {
  type Body_login_login_access_token as AccessToken,
  LoginService,
  type UserOut,
  UsersService,
} from "../client";

const isLoggedIn = () => {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage.getItem("access_token") !== null;
  }

  return false;
};

const useAuth = () => {
  const navigate = useRouter();
  const { data: user, isLoading } = useQuery<UserOut | null, Error>(
    "currentUser",
    UsersService.readUserMe,
    {
      enabled: isLoggedIn(),
    },
  );

  const queryClient = useQueryClient();

  const currentUser = queryClient.getQueryData<UserOut>("currentUser");

  const login = async (data: AccessToken) => {
    const response = await LoginService.loginAccessToken({
      formData: data,
    });

    localStorage.setItem("access_token", response.access_token);
    navigate.push("./");
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    navigate.push("/login");
  };

  return { login, logout, user, isLoading, currentUser };
};

export { isLoggedIn };
export default useAuth;
