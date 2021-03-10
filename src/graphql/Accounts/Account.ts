import gql from "graphql-tag";
export const GET_ACCOUNTS = gql`
  query Accounts {
    accounts {
      id
      account
      network
      group
      resource
      service
      emsemble
      description
    }
  }
`;
